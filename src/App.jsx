
import React, { useEffect, useState } from 'react';
import { Search, Briefcase, Menu, User, LogOut, PlusCircle, ClipboardList } from 'lucide-react';
import { supabase } from './supabase';

export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [jobs, setJobs] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [quotesMessage, setQuotesMessage] = useState('');
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [artisanJobs, setArtisanJobs] = useState([]);
  const [assignedJobs, setAssignedJobs] = useState([]);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [assignedError, setAssignedError] = useState('');
  const [completionSavingId, setCompletionSavingId] = useState(null);
  const [completionMessage, setCompletionMessage] = useState('');
  const [chatJobId, setChatJobId] = useState(null);
  const [chatTitle, setChatTitle] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [chatError, setChatError] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [artisanMessage, setArtisanMessage] = useState('');
  const [activeQuoteJob, setActiveQuoteJob] = useState(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteDescription, setQuoteDescription] = useState('');
  const [quoteSaving, setQuoteSaving] = useState(false);
  const [acceptingQuoteId, setAcceptingQuoteId] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authRole, setAuthRole] = useState('client');
  const [authMessage, setAuthMessage] = useState('');
  const [authSaving, setAuthSaving] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    town: '',
    province: '',
    urgency: 'medium'
  });

  useEffect(() => {
    let mounted = true;

    async function loadUser(userSession) {
      if (!mounted) return;

      setSession(userSession);

      if (!userSession) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', userSession.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) console.error('Errore profilo:', error);

      setProfile(data || null);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      loadUser(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        loadUser(newSession);
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session && profile?.role === 'client') {
      loadJobs();
    }
    if (session && profile?.role === 'artisan') {
      loadArtisanJobs();
      loadAssignedJobs();
    }
  }, [session, profile]);

  useEffect(() => {
    if (!chatJobId || !session?.user?.id) return;
    let alive = true;
    async function refreshChat() {
      const { data, error } = await supabase
        .from('job_messages')
        .select('id, job_id, sender_id, body, created_at')
        .eq('job_id', chatJobId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (!alive) return;
      if (error) setChatError('Errore caricamento chat: ' + error.message);
      else { setChatMessages(data || []); setChatError(''); }
    }
    refreshChat();
    const timer = setInterval(refreshChat, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [chatJobId, session?.user?.id]);

  function openChat(job) {
    setChatJobId(job.id);
    setChatTitle(job.title);
    setChatText('');
    setChatMessages([]);
    setChatError('');
  }

  async function sendChatMessage(event) {
    event.preventDefault();
    const body = chatText.trim();
    if (!body || !chatJobId || !session?.user?.id || chatSending) return;
    setChatSending(true);
    const { error } = await supabase.from('job_messages').insert({
      job_id: chatJobId, sender_id: session.user.id, body
    });
    setChatSending(false);
    if (error) { setChatError('Invio non riuscito: ' + error.message); return; }
    setChatText('');
    const { data } = await supabase.from('job_messages')
      .select('id, job_id, sender_id, body, created_at')
      .eq('job_id', chatJobId).order('created_at', { ascending: true }).limit(200);
    if (data) setChatMessages(data);
  }

  async function loadJobs() {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('client_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Errore caricamento richieste:', error);
      return;
    }

    setJobs(data || []);
    await loadClientQuotes(data || []);
  }

  async function loadClientQuotes(clientJobs) {
    const jobIds = clientJobs.map(job => job.id);
    setQuotesMessage('');
    if (jobIds.length === 0) {
      setQuotes([]);
      return;
    }

    setQuotesLoading(true);
    const { data, error } = await supabase
      .from('quotes')
      .select('id, job_id, artisan_id, amount, description, status, created_at')
      .in('job_id', jobIds)
      .order('created_at', { ascending: false });
    setQuotesLoading(false);

    if (error) {
      console.error('Errore caricamento preventivi:', error);
      setQuotesMessage('Non riesco a caricare i preventivi: ' + error.message);
      return;
    }

    setQuotes(data || []);
  }

  async function acceptQuote(quote) {
    if (!session || !window.confirm('Vuoi accettare questo preventivo? Gli altri preventivi per lo stesso lavoro saranno rifiutati.')) return;
    setQuotesMessage('');
    setAcceptingQuoteId(quote.id);
    try {
      const { error } = await supabase.rpc('accept_quote', { p_quote_id: quote.id });
      if (error) throw error;
      await loadJobs();
      setMessage('Preventivo accettato! Il lavoro è stato assegnato.');
    } catch (error) {
      setQuotesMessage('Impossibile accettare il preventivo: ' + error.message);
    } finally {
      setAcceptingQuoteId(null);
    }
  }

  async function advanceCompletion(job, isClient) {
    const prompt = isClient
      ? 'Confermi che il lavoro è stato completato?'
      : 'Confermi di aver terminato il lavoro? Il cliente dovrà approvarlo.';
    if (!window.confirm(prompt)) return;
    setCompletionSavingId(job.id);
    setCompletionMessage('');
    try {
      const { error } = await supabase.rpc('advance_job_completion', { p_job_id: job.id });
      if (error) throw error;
      if (isClient) await loadJobs();
      else await loadAssignedJobs();
      setCompletionMessage(isClient ? 'Lavoro completato e confermato!' : 'Lavoro segnato come terminato. In attesa del cliente.');
    } catch (error) {
      setCompletionMessage('Errore aggiornamento lavoro: ' + error.message);
    } finally {
      setCompletionSavingId(null);
    }
  }

  async function loadArtisanJobs() {
    setArtisanMessage('');
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Errore caricamento lavori:', error);
      setArtisanMessage('Non riesco a caricare le richieste: ' + error.message);
      return;
    }

    setArtisanJobs(data || []);
  }

  async function loadAssignedJobs() {
    if (!session?.user?.id) return;
    setAssignedLoading(true);
    setAssignedError('');
    // RLS limita la lettura ai soli preventivi dell'artigiano autenticato.
    const { data: acceptedQuotes, error: quotesError } = await supabase
      .from('quotes')
      .select('id, job_id, amount, description, status, created_at')
      .eq('artisan_id', session.user.id)
      .eq('status', 'accepted');

    if (quotesError) {
      setAssignedError('Impossibile caricare i preventivi accettati: ' + quotesError.message);
      setAssignedLoading(false);
      return;
    }
    if (!acceptedQuotes?.length) {
      setAssignedJobs([]);
      setAssignedLoading(false);
      return;
    }
    const jobIds = [...new Set(acceptedQuotes.map(q => q.job_id))];
    const { data: assigned, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title, description, category, town, province, urgency, status, accepted_quote_id, created_at')
      .in('id', jobIds)
      .in('status', ['assigned', 'work_done', 'completed']);
    if (jobsError) {
      setAssignedError('Impossibile caricare i lavori assegnati: ' + jobsError.message);
      setAssignedLoading(false);
      return;
    }
    const byId = new Map(acceptedQuotes.map(q => [q.id, q]));
    setAssignedJobs((assigned || [])
      .filter(job => byId.has(job.accepted_quote_id))
      .map(job => ({ ...job, acceptedQuote: byId.get(job.accepted_quote_id) }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    setAssignedLoading(false);
  }

  async function submitQuote(event) {
    event.preventDefault();
    setArtisanMessage('');

    const amount = Number(quoteAmount);
    if (!activeQuoteJob || !Number.isFinite(amount) || amount <= 0) {
      setArtisanMessage('Inserisci un importo valido maggiore di zero.');
      return;
    }

    setQuoteSaving(true);
    const { error } = await supabase
      .from('quotes')
      .insert({
        job_id: activeQuoteJob,
        artisan_id: session.user.id,
        amount,
        description: quoteDescription.trim() || null
      });

    setQuoteSaving(false);

    if (error) {
      console.error('Errore invio preventivo:', error);
      setArtisanMessage(
        error.code === '23505'
          ? 'Hai già inviato un preventivo per questa richiesta.'
          : 'Errore durante l’invio: ' + error.message
      );
      return;
    }

    setArtisanMessage('Preventivo inviato con successo!');
    setActiveQuoteJob(null);
    setQuoteAmount('');
    setQuoteDescription('');
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthMessage('');
    setAuthSaving(true);

    if (authMode === 'register') {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
        options: {
          data: {
            full_name: authName.trim(),
            role: authRole
          }
        }
      });

      if (error) {
        setAuthMessage(error.message);
        setAuthSaving(false);
        return;
      }

      // Se Supabase restituisce una sessione subito, proviamo a creare/aggiornare
      // il profilo. Se è attiva la conferma email, il profilo deve essere creato
      // dal trigger Supabase già usato dal progetto, leggendo raw_user_meta_data.
      if (data.session && data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            full_name: authName.trim(),
            role: authRole
          }, { onConflict: 'id' });

        if (profileError) {
          setAuthMessage(
            'Account creato, ma non è stato possibile salvare il profilo: ' +
            profileError.message
          );
          setAuthSaving(false);
          return;
        }

        setAuthMessage('Registrazione completata. Accesso in corso...');
      } else {
        setAuthMessage(
          'Account creato. Controlla la tua email per confermare la registrazione. ' +
          'Il profilo deve essere creato dal trigger Supabase usando il ruolo scelto.'
        );
      }

      setAuthSaving(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword
    });

    if (error) setAuthMessage(error.message);
    setAuthSaving(false);
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) alert(error.message);
  }

  function updateField(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value
    });
  }

  async function publishJob(event) {
    event.preventDefault();
    setMessage('');

    if (!form.title.trim() || !form.description.trim() ||
        !form.category || !form.town.trim() || !form.province.trim()) {
      setMessage('Compila tutti i campi obbligatori.');
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('jobs')
      .insert({
        client_id: session.user.id,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        town: form.town.trim(),
        province: form.province.trim(),
        urgency: form.urgency,
        status: 'open'
      });

    setSaving(false);

    if (error) {
      console.error('Errore pubblicazione:', error);
      setMessage('Errore: ' + error.message);
      return;
    }

    setMessage('Richiesta pubblicata con successo!');
    setForm({
      title: '',
      description: '',
      category: '',
      town: '',
      province: '',
      urgency: 'medium'
    });
    setShowForm(false);
    setActiveTab('Richieste');
    await loadJobs();
  }

  if (loading) {
    return <div style={{ padding: 30 }}>Caricamento IHFY...</div>;
  }

  const inputStyle = {
    width: '100%',
    padding: 13,
    border: '1px solid #ddd',
    borderRadius: 9,
    boxSizing: 'border-box',
    fontSize: 15
  };

  const buttonStyle = {
    background: '#2563eb',
    color: 'white',
    padding: 14,
    border: 'none',
    borderRadius: 10,
    fontWeight: 'bold',
    cursor: 'pointer'
  };

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      background: '#f7f8fa',
      minHeight: '100vh',
      color: '#202938',
      paddingBottom: 85
    }}>
      <header style={{
        background: '#fff',
        padding: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ color: '#2563eb', margin: 0 }}>IHFY</h1>
        {session ? (
          <button onClick={logout} style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer'
          }}>
            <LogOut size={20} /> Esci
          </button>
        ) : <Menu size={26} />}
      </header>

      <main style={{ padding: 24 }}>
        {!session ? (
          <section style={{
            maxWidth: 460,
            margin: '20px auto',
            background: '#fff',
            padding: 22,
            borderRadius: 14,
            boxShadow: '0 2px 12px rgba(0,0,0,0.05)'
          }}>
            <h2>{authMode === 'login' ? 'Accedi a IHFY' : 'Crea il tuo account IHFY'}</h2>
            <p>Trova il professionista giusto o entra nella tua area professionale.</p>

            <form onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <>
                  <label>Nome e cognome</label>
                  <input
                    value={authName}
                    onChange={event => setAuthName(event.target.value)}
                    style={{ ...inputStyle, marginTop: 8, marginBottom: 16 }}
                    autoComplete="name"
                    required
                  />

                  <label>Tipo di account</label>
                  <select
                    value={authRole}
                    onChange={event => setAuthRole(event.target.value)}
                    style={{ ...inputStyle, marginTop: 8, marginBottom: 16 }}
                  >
                    <option value="client">Cliente</option>
                    <option value="artisan">Artigiano</option>
                  </select>
                </>
              )}

              <label>Email</label>
              <input
                type="email"
                value={authEmail}
                onChange={event => setAuthEmail(event.target.value)}
                style={{ ...inputStyle, marginTop: 8, marginBottom: 16 }}
                autoComplete="email"
                required
              />

              <label>Password (almeno 6 caratteri)</label>
              <input
                type="password"
                value={authPassword}
                onChange={event => setAuthPassword(event.target.value)}
                style={{ ...inputStyle, marginTop: 8, marginBottom: 16 }}
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                minLength={6}
                required
              />

              {authMessage && (
                <p style={{ color: authMessage.includes('completata') || authMessage.includes('Controlla') ? '#15803d' : '#b91c1c' }}>
                  {authMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={authSaving}
                style={{ ...buttonStyle, width: '100%', opacity: authSaving ? 0.7 : 1 }}
              >
                {authSaving
                  ? 'Attendi...'
                  : authMode === 'login'
                    ? 'Accedi'
                    : 'Crea account'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setAuthMessage('');
              }}
              style={{
                ...buttonStyle,
                width: '100%',
                marginTop: 12,
                background: '#475569'
              }}
            >
              {authMode === 'login'
                ? 'Non hai un account? Registrati'
                : 'Hai già un account? Accedi'}
            </button>
          </section>
        ) : !profile ? (
          <h2>Profilo non trovato. Controlla Supabase.</h2>
        ) : profile.role === 'client' ? (
          <>
            <h2>Ciao {profile.full_name || 'Cliente'}!</h2>
            <p>Benvenuto nella tua area personale.</p>

            {completionMessage && <p style={{ fontWeight: 'bold' }}>{completionMessage}</p>}
            {message && (
              <p style={{ color: '#15803d', fontWeight: 'bold' }}>
                {message}
              </p>
            )}

            {activeTab === 'Home' && (
              <>
                <div style={{
                  background: 'white',
                  padding: 20,
                  borderRadius: 14,
                  marginTop: 20
                }}>
                  <h3>La tua area cliente</h3>
                  <p>Trova professionisti affidabili per i tuoi lavori.</p>
                  <button
                    style={buttonStyle}
                    onClick={() => {
                      setMessage('');
                      setShowForm(true);
                    }}
                  >
                    <PlusCircle size={18} /> Pubblica una richiesta
                  </button>
                </div>

                <h3 style={{ marginTop: 30 }}>Esplora le categorie</h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 15
                }}>
                  {['Idraulici', 'Elettricisti', 'Imbianchini', 'Giardinieri'].map(item => (
                    <div key={item} style={{
                      background: 'white',
                      padding: 22,
                      borderRadius: 14,
                      textAlign: 'center'
                    }}>
                      <Briefcase size={28} color="#2563eb" />
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'Richieste' && (
              <>
                <h3>Le mie richieste</h3>
                <button
                  style={buttonStyle}
                  onClick={() => {
                    setMessage('');
                    setShowForm(true);
                  }}
                >
                  + Nuova richiesta
                </button>

                {jobs.length === 0 ? (
                  <p>Non hai ancora pubblicato richieste.</p>
                ) : jobs.map(job => (
                  <div key={job.id} style={{
                    background: 'white',
                    padding: 18,
                    borderRadius: 12,
                    marginTop: 15
                  }}>
                    <h3>{job.title}</h3>
                    <p>{job.description}</p>
                    <p>{job.category} · {job.town} ({job.province})</p>
                    <p>Urgenza: {job.urgency}</p>
                    <p>Stato: {job.status === 'assigned' ? 'Assegnato' : job.status === 'work_done' ? 'Terminato dall’artigiano · da confermare' : job.status === 'completed' ? 'Completato' : job.status}</p>
                    {job.status === 'work_done' && (
                      <button type="button" disabled={completionSavingId !== null}
                        onClick={() => advanceCompletion(job, true)}
                        style={{ ...buttonStyle, marginBottom: 12 }}>
                        {completionSavingId === job.id ? 'Conferma in corso...' : 'Conferma completamento'}
                      </button>
                    )}
                    <div style={{
                      marginTop: 16,
                      paddingTop: 12,
                      borderTop: '1px solid #e5e7eb'
                    }}>
                      <h4 style={{ margin: '0 0 10px' }}>Preventivi ricevuti</h4>
                      {quotesLoading ? (
                        <p>Caricamento preventivi...</p>
                      ) : quotes.filter(quote => quote.job_id === job.id).length === 0 ? (
                        <p>Non hai ancora ricevuto preventivi per questa richiesta.</p>
                      ) : quotes.filter(quote => quote.job_id === job.id).map(quote => (
                        <div key={quote.id} style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 10,
                          padding: 12,
                          marginTop: 8
                        }}>
                          <p style={{ fontSize: 18, fontWeight: 'bold', margin: '0 0 6px' }}>
                            {Number(quote.amount).toLocaleString('it-IT', {
                              style: 'currency',
                              currency: 'EUR'
                            })}
                          </p>
                          <p style={{ margin: '4px 0' }}>{quote.description || 'Nessuna descrizione aggiuntiva.'}</p>
                          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
                            Stato: {quote.status || 'pending'} · Inviato il {new Date(quote.created_at).toLocaleDateString('it-IT')}
                          </p>
                          {quote.status === 'accepted' && job.accepted_quote_id === quote.id && (
                            <button type="button" onClick={() => openChat(job)} style={{ ...buttonStyle, marginTop: 10, marginRight: 8 }}>Apri chat</button>
                          )}
                          {quote.status === 'accepted' && (
                            <p style={{ color: '#15803d', fontWeight: 'bold' }}>✓ Preventivo accettato</p>
                          )}
                          {job.status === 'open' && (quote.status === 'pending' || !quote.status) && (
                            <button
                              type="button"
                              disabled={acceptingQuoteId !== null}
                              onClick={() => acceptQuote(quote)}
                              style={{ ...buttonStyle, marginTop: 10, opacity: acceptingQuoteId !== null ? 0.6 : 1 }}
                            >
                              {acceptingQuoteId === quote.id ? 'Accettazione in corso...' : 'Accetta preventivo'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {quotesMessage && (
                  <p style={{ color: '#b91c1c', fontWeight: 'bold' }}>{quotesMessage}</p>
                )}
                <button
                  type="button"
                  onClick={loadJobs}
                  style={{ ...buttonStyle, marginTop: 14, background: '#475569' }}
                >
                  Aggiorna preventivi
                </button>
              </>
            )}

            {activeTab === 'Profilo' && (
              <div style={{
                background: 'white',
                padding: 20,
                borderRadius: 12
              }}>
                <User size={28} color="#2563eb" />
                <h3>Il mio profilo</h3>
                <p>{profile.full_name}</p>
                <p>{session.user.email}</p>
                <p>Ruolo: Cliente</p>
                <button style={buttonStyle} onClick={logout}>Esci</button>
              </div>
            )}

            {showForm && (
              <div style={{
                background: 'white',
                padding: 20,
                borderRadius: 14,
                marginTop: 20,
                border: '1px solid #ddd'
              }}>
                <h2>Pubblica una richiesta</h2>

                <form onSubmit={publishJob}>
                  <label>Titolo del lavoro</label>
                  <input
                    name="title"
                    value={form.title}
                    onChange={updateField}
                    placeholder="Es. Riparazione rubinetto"
                    style={inputStyle}
                    required
                  />

                  <label>Descrizione</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={updateField}
                    placeholder="Descrivi il lavoro da svolgere..."
                    style={{ ...inputStyle, marginTop: 12, minHeight: 100 }}
                    required
                  />

                  <label>Categoria</label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={updateField}
                    style={{ ...inputStyle, marginTop: 12 }}
                    required
                  >
                    <option value="">Scegli categoria</option>
                    <option value="Idraulico">Idraulico</option>
                    <option value="Elettricista">Elettricista</option>
                    <option value="Imbianchino">Imbianchino</option>
                    <option value="Giardiniere">Giardiniere</option>
                    <option value="Altro">Altro</option>
                  </select>

                  <label>Comune</label>
                  <input
                    name="town"
                    value={form.town}
                    onChange={updateField}
                    placeholder="Es. Milano"
                    style={{ ...inputStyle, marginTop: 12 }}
                    required
                  />

                  <label>Provincia</label>
                  <input
                    name="province"
                    value={form.province}
                    onChange={updateField}
                    placeholder="Es. MI"
                    style={{ ...inputStyle, marginTop: 12 }}
                    required
                  />

                  <label>Urgenza</label>
                  <select
                    name="urgency"
                    value={form.urgency}
                    onChange={updateField}
                    style={{ ...inputStyle, marginTop: 12 }}
                  >
                    <option value="low">Bassa</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>

                  {message && (
                    <p style={{ color: '#b91c1c' }}>{message}</p>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    style={{ ...buttonStyle, width: '100%', marginTop: 20 }}
                  >
                    {saving ? 'Pubblicazione...' : 'Pubblica richiesta'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    style={{
                      ...inputStyle,
                      marginTop: 10,
                      background: '#eee',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Annulla
                  </button>
                </form>
              </div>
            )}
          </>
        ) : profile.role === 'artisan' ? (
          <>
            <h2>Ciao {profile.full_name || 'Artigiano'}!</h2>
            <p>Benvenuto nella tua area professionale.</p>
            <div style={{
              background: 'white',
              padding: 20,
              borderRadius: 14,
              marginTop: 20
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap'
              }}>
                <h3 style={{ margin: 0 }}>Richieste disponibili</h3>
                <button
                  type="button"
                  onClick={loadArtisanJobs}
                  style={{ ...buttonStyle, background: '#475569' }}
                >
                  Aggiorna
                </button>
              </div>

              {artisanMessage && (
                <p style={{
                  color: artisanMessage.includes('successo') ? '#15803d' : '#b91c1c',
                  fontWeight: 'bold'
                }}>
                  {artisanMessage}
                </p>
              )}

              {artisanJobs.length === 0 ? (
                <p>Al momento non ci sono richieste aperte.</p>
              ) : artisanJobs.map(job => (
                <div key={job.id} style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 15
                }}>
                  <h3 style={{ marginTop: 0 }}>{job.title}</h3>
                  <p>{job.description}</p>
                  <p><strong>Categoria:</strong> {job.category}</p>
                  <p><strong>Località:</strong> {job.town} ({job.province})</p>
                  <p><strong>Urgenza:</strong> {job.urgency}</p>

                  {activeQuoteJob === job.id ? (
                    <form onSubmit={submitQuote}>
                      <label>Importo del preventivo (€)</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={quoteAmount}
                        onChange={event => setQuoteAmount(event.target.value)}
                        placeholder="Es. 150"
                        style={{ ...inputStyle, marginTop: 8, marginBottom: 12 }}
                        required
                      />
                      <label>Messaggio e dettagli (facoltativo)</label>
                      <textarea
                        value={quoteDescription}
                        onChange={event => setQuoteDescription(event.target.value)}
                        placeholder="Descrivi cosa comprende il preventivo..."
                        style={{ ...inputStyle, marginTop: 8, minHeight: 90 }}
                      />
                      <button
                        type="submit"
                        disabled={quoteSaving}
                        style={{ ...buttonStyle, width: '100%', marginTop: 12 }}
                      >
                        {quoteSaving ? 'Invio...' : 'Invia preventivo'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveQuoteJob(null);
                          setQuoteAmount('');
                          setQuoteDescription('');
                        }}
                        style={{
                          ...buttonStyle,
                          width: '100%',
                          marginTop: 8,
                          background: '#64748b'
                        }}
                      >
                        Annulla
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveQuoteJob(job.id);
                        setArtisanMessage('');
                      }}
                      style={buttonStyle}
                    >
                      Invia un preventivo
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ background: 'white', padding: 20, borderRadius: 14, marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}>I miei lavori ({assignedJobs.length})</h3>
                <button type="button" onClick={loadAssignedJobs} style={{ ...buttonStyle, background: '#475569' }}>Aggiorna</button>
              </div>
              {assignedLoading ? <p>Caricamento lavori assegnati...</p> : null}
              {assignedError ? <p style={{ color: '#b91c1c' }}>{assignedError}</p> : null}
              {completionMessage && <p>{completionMessage}</p>}
              {!assignedLoading && !assignedError && assignedJobs.length === 0 ? (
                <p>Non hai ancora lavori assegnati. Quando un cliente accetta un tuo preventivo, lo troverai qui.</p>
              ) : assignedJobs.map(job => (
                <div key={job.id} style={{ border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 12, padding: 16, marginTop: 15 }}>
                  <p style={{ color: '#166534', fontWeight: 'bold', marginTop: 0 }}>
                    {job.status === 'completed' ? '✓ Lavoro completato' : job.status === 'work_done' ? 'In attesa della conferma del cliente' : '✓ Preventivo accettato · Lavoro assegnato'}
                  </p>
                  <h3>{job.title}</h3>
                  <p>{job.description}</p>
                  <p><strong>Categoria:</strong> {job.category}</p>
                  <p><strong>Località:</strong> {job.town} ({job.province})</p>
                  <p><strong>Urgenza:</strong> {job.urgency}</p>
                  <p><strong>Importo concordato:</strong> {Number(job.acceptedQuote.amount).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</p>
                  {job.acceptedQuote.description && <p><strong>Dettagli preventivo:</strong> {job.acceptedQuote.description}</p>}
                  {job.status === 'assigned' && (
                    <button type="button" disabled={completionSavingId !== null}
                      onClick={() => advanceCompletion(job, false)}
                      style={{ ...buttonStyle, marginRight: 8, marginBottom: 8 }}>
                      {completionSavingId === job.id ? 'Salvataggio...' : 'Segna lavoro terminato'}
                    </button>
                  )}
                  <button type="button" onClick={() => openChat(job)} style={buttonStyle}>Apri chat con il cliente</button>
                </div>
              ))}
            </div>
            <div style={{
              background: 'white',
              padding: 20,
              borderRadius: 14,
              marginTop: 16
            }}>
              <h3>Il mio profilo professionale</h3>
              <p>{profile.full_name || 'Artigiano'}</p>
              <p>{session.user.email}</p>
              <p>Ruolo: Artigiano</p>
              <button style={buttonStyle} onClick={logout}>Esci</button>
            </div>
          </>
        ) : (
          <h2>Ruolo non riconosciuto: {profile.role}</h2>
        )}
        {session && chatJobId && (
          <div role="dialog" aria-modal="true" aria-label="Chat del lavoro" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.65)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 12 }}>
            <section style={{ width: '100%', maxWidth: 560, height: 'min(720px, 90vh)', background: '#fff', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <header style={{ padding: 16, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div><strong>Chat privata</strong><div style={{ fontSize: 13, color: '#64748b' }}>{chatTitle}</div></div>
                <button type="button" onClick={() => setChatJobId(null)} style={{ ...buttonStyle, background: '#475569' }}>Chiudi</button>
              </header>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#f8fafc' }}>
                {chatMessages.length === 0 && <p style={{ color: '#64748b' }}>Nessun messaggio. Inizia la conversazione!</p>}
                {chatMessages.map(m => (
                  <div key={m.id} style={{ maxWidth: '85%', margin: m.sender_id === session.user.id ? '8px 0 8px auto' : '8px auto 8px 0', padding: 12, borderRadius: 12, background: m.sender_id === session.user.id ? '#dbeafe' : '#fff', border: '1px solid #e2e8f0', overflowWrap: 'anywhere' }}>
                    <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>{m.sender_id === session.user.id ? 'Tu' : 'Interlocutore'}</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                    <div style={{ color: '#64748b', fontSize: 11, marginTop: 5 }}>{new Date(m.created_at).toLocaleString('it-IT')}</div>
                  </div>
                ))}
              </div>
              {chatError && <p style={{ color: '#b91c1c', padding: '0 16px' }}>{chatError}</p>}
              <form onSubmit={sendChatMessage} style={{ padding: 12, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8 }}>
                <input aria-label="Scrivi un messaggio" placeholder="Scrivi un messaggio..." value={chatText} maxLength={2000} onChange={e => setChatText(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 0 }} required />
                <button type="submit" disabled={chatSending || !chatText.trim()} style={{ ...buttonStyle, opacity: chatSending ? .6 : 1 }}>{chatSending ? 'Invio...' : 'Invia'}</button>
              </form>
            </section>
          </div>
        )}
      </main>

      {session && profile?.role === 'client' && (
        <nav style={{
          position: 'fixed',
          bottom: 0,
          width: '100%',
          background: 'white',
          display: 'flex',
          justifyContent: 'space-around',
          padding: '16px 0'
        }}>
          {[
            { name: 'Home', icon: <Search size={18} /> },
            { name: 'Richieste', icon: <ClipboardList size={18} /> },
            { name: 'Profilo', icon: <User size={18} /> }
          ].map(tab => (
            <button
              key={tab.name}
              onClick={() => {
                setActiveTab(tab.name);
                setShowForm(false);
                setMessage('');
              }}
              style={{
                border: 'none',
                background: 'none',
                color: activeTab === tab.name ? '#2563eb' : '#777',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer'
              }}
            >
              {tab.icon}
              {tab.name}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
