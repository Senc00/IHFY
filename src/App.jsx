
import React, { useEffect, useState } from 'react';
import { Search, Briefcase, Menu, User, LogOut, PlusCircle, ClipboardList, CheckCircle2, Clock3, ArrowRight, House, Camera, Wrench, MessageCircle, ShieldCheck, Zap, Paintbrush, Leaf } from 'lucide-react';
import { supabase } from './supabase';

export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [jobFilter, setJobFilter] = useState('all');
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
  const [jobPhotos, setJobPhotos] = useState({});
  const [photoBusy, setPhotoBusy] = useState(null);
  const [photoError, setPhotoError] = useState('');
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

  // Foto private: URL firmati con scadenza di 1 ora, generati per ogni caricamento.
  async function loadPhotosForJobs(jobList) {
    const ids = [...new Set((jobList || []).map(j => j.id))];
    if (!ids.length) { setJobPhotos({}); return; }
    const { data, error } = await supabase.from('job_photos')
      .select('id, job_id, uploader_id, photo_type, storage_path, created_at')
      .in('job_id', ids).order('created_at', { ascending: true });
    if (error) { setPhotoError('Errore lettura foto: ' + error.message); return; }
    const rows = data || [];
    const signed = await Promise.all(rows.map(async p => {
      const { data: urlData, error: urlError } = await supabase.storage
        .from('job-photos').createSignedUrl(p.storage_path, 3600);
      return { ...p, url: urlError ? null : urlData?.signedUrl };
    }));
    setJobPhotos(previous => {
      const next = { ...previous };
      ids.forEach(id => { next[id] = signed.filter(p => p.job_id === id); });
      return next;
    });
  }

  async function uploadJobPhoto(job, type, event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !session?.user?.id) return;
    const allowed = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    if (!allowed[file.type]) { setPhotoError('Sono consentite solo immagini JPG, PNG o WebP.'); return; }
    if (file.size > 5 * 1024 * 1024) { setPhotoError('La foto deve pesare al massimo 5 MB.'); return; }
    setPhotoError('');
    setPhotoBusy(job.id);
    const path = `${job.id}/${session.user.id}/${crypto.randomUUID()}.${allowed[file.type]}`;
    try {
      const { error: uploadError } = await supabase.storage.from('job-photos')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error: recordError } = await supabase.from('job_photos').insert({
        job_id: job.id, uploader_id: session.user.id,
        photo_type: type, storage_path: path
      });
      if (recordError) throw recordError;
      await loadPhotosForJobs([{ id: job.id }]);
    } catch (error) {
      setPhotoError('Caricamento foto non riuscito: ' + error.message);
    } finally {
      setPhotoBusy(null);
    }
  }

  function PhotoGallery({ job, allowUpload, type }) {
    const photos = (jobPhotos[job.id] || []).filter(p => p.photo_type === type);
    return (
      <div style={{ marginTop: 14, padding: 12, border: '1px solid #e2e8f0', borderRadius: 10 }}>
        <strong>{type === 'before' ? 'Foto del problema' : 'Foto del lavoro eseguito'}</strong>
        {photos.length === 0 && <p style={{ color: '#64748b' }}>Nessuna foto caricata.</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
          {photos.map(p => p.url ? (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" title="Apri foto">
              <img src={p.url} alt={type === 'before' ? 'Foto del problema' : 'Foto del lavoro eseguito'}
                style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 8 }} />
            </a>
          ) : <span key={p.id}>Foto non disponibile</span>)}
        </div>
        {allowUpload && (
          <label style={{ display: 'inline-block', marginTop: 12, cursor: photoBusy ? 'wait' : 'pointer', color: '#2563eb', fontWeight: 'bold' }}>
            {photoBusy === job.id ? 'Caricamento...' : '+ Aggiungi foto (max 5 MB)'}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy !== null}
              onChange={event => uploadJobPhoto(job, type, event)} style={{ display: 'block', marginTop: 6, maxWidth: '100%' }} />
          </label>
        )}
      </div>
    );
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
    await loadPhotosForJobs(data || []);
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
    await loadPhotosForJobs(data || []);

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
    await loadPhotosForJobs(assigned || []);
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
    setSelectedJobId(null);
    setJobFilter('all');
    setActiveTab('Richieste');
    await loadJobs();
  }

  function goHome() {
    setActiveTab('Home');
    setSelectedJobId(null);
    setJobFilter('all');
    setShowForm(false);
    setChatJobId(null);
    setActiveQuoteJob(null);
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    <div className="ihfy-premium" style={{
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
      background: '#fafbfc',
      minHeight: '100vh',
      color: '#202938',
      paddingBottom: 85
    }}>

      <style>{`
        .ihfy-premium { --ihfy-blue:#2563eb; --ihfy-teal:#0d9488; --ihfy-ink:#172033; --ihfy-muted:#718096; color:var(--ihfy-ink); }
        .ihfy-premium * { box-sizing:border-box; }
        .ihfy-premium .ihfy-topbar { position:sticky; top:0; z-index:30; border-bottom:1px solid #eef0f4; box-shadow:0 3px 20px rgba(20,38,66,.035); }
        .ihfy-premium .ihfy-topbar h1 { letter-spacing:-1.5px; font-size:29px; font-weight:850; }
        .ihfy-premium .ihfy-main { max-width:1100px; margin:0 auto; padding:28px 20px 50px !important; }
        .ihfy-premium .ihfy-main h2 { letter-spacing:-.7px; }
        .ihfy-premium .ihfy-main h3 { letter-spacing:-.35px; }
        .ihfy-premium .ihfy-main section, .ihfy-premium .ihfy-main > div:not([role=dialog]) { border-radius:18px; }
        .ihfy-premium .ihfy-main div[style*="background: white"], .ihfy-premium .ihfy-main div[style*="background: rgb(255, 255, 255)"] { border:1px solid #edf0f5; box-shadow:0 8px 26px rgba(26,51,94,.035); }
        .ihfy-premium button { transition:transform .15s ease,box-shadow .15s ease,filter .15s ease; }
        .ihfy-premium button:not(:disabled):hover { filter:brightness(1.035); transform:translateY(-1px); }
        .ihfy-premium button:focus-visible, .ihfy-premium input:focus-visible, .ihfy-premium textarea:focus-visible, .ihfy-premium select:focus-visible { outline:3px solid rgba(37,99,235,.25); outline-offset:2px; }
        .ihfy-premium input,.ihfy-premium textarea,.ihfy-premium select { background:#fff; border-color:#e2e8f0 !important; }
        .ihfy-premium .ihfy-bottom-nav { left:0;right:0;width:100% !important;z-index:35;border-top:1px solid #edf0f5;box-shadow:0 -6px 24px rgba(20,46,90,.045);padding:13px 12px max(13px,env(safe-area-inset-bottom)) !important; }
        .ihfy-premium .ihfy-bottom-nav button { flex-direction:column;justify-content:center;gap:5px !important;min-width:74px;font-size:12px; }
        .ihfy-premium .ihfy-shortcuts { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:24px 0 32px; }
        .ihfy-premium .ihfy-shortcut { background:#fff;color:#334155;border:1px solid #edf0f5;border-radius:20px;padding:18px 8px 14px;min-height:118px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;box-shadow:0 10px 24px rgba(35,49,70,.055);cursor:pointer;font-weight:650;font-size:13px;text-align:center; }
        .ihfy-premium .ihfy-shortcut-icon { width:46px;height:46px;border-radius:15px;background:#f0f2f5;color:#91a0af;display:flex;align-items:center;justify-content:center; }
        .ihfy-premium .ihfy-shortcut:active { transform:scale(.98); }
        .ihfy-premium .ihfy-recent-card { width:100%;display:flex;align-items:center;text-align:left;gap:13px;background:#fff;border:1px solid #edf0f5;border-radius:18px;padding:16px;cursor:pointer;box-shadow:0 8px 22px rgba(26,51,94,.04);color:#172033; }
        .ihfy-premium .ihfy-recent-icon { width:52px;height:52px;flex-shrink:0;background:#f0f2f5;border-radius:14px;color:#91a0af;display:flex;align-items:center;justify-content:center; }
        .ihfy-premium .ihfy-status-pill { display:inline-block;border-radius:20px;background:#e8f2ff;color:#2563eb;padding:5px 10px;font-size:11px;font-weight:700;margin-top:7px; }
        .ihfy-premium .ihfy-section-heading { display:flex;justify-content:space-between;align-items:center;gap:12px;margin:10px 0 16px; }
        @media(min-width:800px) { .ihfy-premium .ihfy-main { padding:36px 32px 70px !important; } }
        @media(max-width:480px) { .ihfy-premium .ihfy-main { padding:18px 14px 45px !important; } .ihfy-premium .ihfy-topbar { padding:16px !important; } .ihfy-premium .ihfy-shortcuts { gap:8px; } .ihfy-premium .ihfy-shortcut { min-height:108px;font-size:11px;padding:12px 4px; } .ihfy-premium .ihfy-shortcut-icon { width:40px;height:40px; } }
        @media(prefers-reduced-motion:reduce) { .ihfy-premium button { transition:none; } }
      `}</style>
      <header className="ihfy-topbar" style={{
        background: '#fff',
        padding: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ color: '#2563eb', margin: 0 }}>IHFY</h1>
        {session ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={goHome} aria-label="Torna alla Home"
              style={{ border: '1px solid #e2e8f0', background: '#f1f5f9', color: '#64748b',
                borderRadius: 12, padding: '10px 12px', display: 'inline-flex',
                alignItems: 'center', gap: 7, cursor: 'pointer', fontWeight: 700 }}>
              <House size={19} /> <span>Home</span>
            </button>
            <button onClick={logout} style={{ border: 'none', background: 'none',
              color: '#64748b', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <LogOut size={19} /> Esci
            </button>
          </div>
        ) : <Menu size={26} />}
      </header>

      <main className="ihfy-main" style={{ padding: 24 }}>
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
            {photoError && <p style={{ color: '#b91c1c' }}>{photoError}</p>}
            {message && (
              <p style={{ color: '#15803d', fontWeight: 'bold' }}>
                {message}
              </p>
            )}

            {activeTab === 'Home' && (
              <>
                <div style={{marginTop:8,marginBottom:6,color:'#64748b'}}>Gestisci le tue richieste e i tuoi lavori</div>
                <div className="ihfy-shortcuts">
                  {[
                    { label:'Nuova richiesta', Icon:PlusCircle, action:()=>{setMessage('');setShowForm(true);} },
                    { label:'Le mie richieste', Icon:ClipboardList, action:()=>{setSelectedJobId(null);setJobFilter('all');setActiveTab('Richieste');} },
                    { label:'Lavori in corso', Icon:Briefcase, action:()=>{setSelectedJobId(null);setJobFilter('active');setActiveTab('Richieste');} },
                    { label:'Completati', Icon:CheckCircle2, action:()=>{setSelectedJobId(null);setJobFilter('completed');setActiveTab('Richieste');} }
                  ].map(({label,Icon,action})=>(
                    <button key={label} type="button" className="ihfy-shortcut" onClick={action}>
                      <span className="ihfy-shortcut-icon"><Icon size={23} strokeWidth={1.9}/></span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <div className="ihfy-section-heading">
                  <h3 style={{margin:0,fontSize:21}}>Richieste recenti</h3>
                  <button type="button" onClick={()=>{setSelectedJobId(null);setJobFilter('all');setActiveTab('Richieste');}} style={{border:0,background:'transparent',color:'#2563eb',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>Vedi tutte <ArrowRight size={17}/></button>
                </div>
                {jobs.length === 0 ? <div style={{background:'#fff',border:'1px solid #edf0f5',padding:22,borderRadius:18,color:'#64748b'}}>Non hai ancora richieste. Premi “Nuova richiesta” per iniziare.</div> : (
                  <div style={{display:'grid',gap:12}}>
                    {jobs.slice(0,3).map(job=>(
                      <button type="button" className="ihfy-recent-card" key={job.id} onClick={()=>{setSelectedJobId(job.id);setJobFilter('all');setActiveTab('Richieste');}}>
                        <span className="ihfy-recent-icon"><Wrench size={25}/></span>
                        <span style={{flex:1,minWidth:0}}>
                          <strong style={{display:'block',fontSize:15,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{job.title}</strong>
                          <span style={{display:'block',color:'#64748b',fontSize:12,marginTop:3}}>{job.category} · {job.town}</span>
                          <span className="ihfy-status-pill">{job.status === 'completed' ? 'Completato' : job.status === 'work_done' ? 'In attesa del cliente' : job.status === 'assigned' ? 'Lavoro assegnato' : 'Richiesta aperta'}</span>
                        </span>
                        <ArrowRight size={18} color="#94a3b8"/>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{marginTop:30,color:'#64748b',fontSize:13}}>IHFY · I tuoi lavori, in un unico posto.</div>
              </>
            )}

            {activeTab === 'Richieste' && (
              <>
                <h3>{selectedJobId ? 'Dettaglio richiesta' : jobFilter === 'active' ? 'Lavori in corso' : jobFilter === 'completed' ? 'Lavori completati' : 'Le mie richieste'}</h3>
                {selectedJobId && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <button type="button" onClick={goHome} style={{ ...buttonStyle, background: '#64748b' }}>
                      ← Torna alla Home
                    </button>
                    <button type="button" onClick={() => setSelectedJobId(null)}
                      style={{ ...buttonStyle, background: '#e2e8f0', color: '#334155' }}>
                      Tutte le richieste
                    </button>
                  </div>
                )}
                <button
                  style={buttonStyle}
                  onClick={() => {
                    setMessage('');
                    setShowForm(true);
                  }}
                >
                  + Nuova richiesta
                </button>

                {jobs.filter(job => selectedJobId ? job.id === selectedJobId : jobFilter === 'active' ? ['assigned','work_done'].includes(job.status) : jobFilter === 'completed' ? job.status === 'completed' : true).length === 0 ? (
                  <p>Nessuna richiesta in questa sezione.</p>
                ) : jobs.filter(job => selectedJobId ? job.id === selectedJobId : jobFilter === 'active' ? ['assigned','work_done'].includes(job.status) : jobFilter === 'completed' ? job.status === 'completed' : true).map(job => (
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
                    <PhotoGallery job={job} type="before" allowUpload={['open','assigned','work_done'].includes(job.status)} />
                    {job.status !== 'open' && <PhotoGallery job={job} type="after" allowUpload={false} />}
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
              <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowForm(false); }} style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(15,23,42,.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
              <div role="dialog" aria-modal="true" aria-label="Nuova richiesta" style={{
                width:'100%', maxWidth:540, maxHeight:'min(90dvh,820px)', overflowY:'auto',
                background: 'white',
                padding: 20,
                borderRadius: 14,
                marginTop: 20,
                border: '1px solid #ddd'
              }}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
                  <h2 style={{marginTop:0}}>Pubblica una richiesta</h2>
                  <button type="button" aria-label="Chiudi finestra" disabled={saving} onClick={()=>setShowForm(false)} style={{border:0,background:'#f1f5f9',borderRadius:12,padding:'8px 12px',cursor:'pointer'}}>✕</button>
                </div>

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
                  <PhotoGallery job={job} type="before" allowUpload={false} />

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
              {photoError && <p style={{ color: '#b91c1c' }}>{photoError}</p>}
              {!assignedLoading && !assignedError && assignedJobs.length === 0 ? (
                <p>Non hai ancora lavori assegnati. Quando un cliente accetta un tuo preventivo, lo troverai qui.</p>
              ) : assignedJobs.map(job => (
                <div key={job.id} style={{ border: '1px solid #dce8f6', background: '#ffffff', borderRadius: 12, padding: 16, marginTop: 15 }}>
                  <p style={{ color: '#166534', fontWeight: 'bold', marginTop: 0 }}>
                    {job.status === 'completed' ? '✓ Lavoro completato' : job.status === 'work_done' ? 'In attesa della conferma del cliente' : '✓ Preventivo accettato · Lavoro assegnato'}
                  </p>
                  <h3>{job.title}</h3>
                  <p>{job.description}</p>
                  <p><strong>Categoria:</strong> {job.category}</p>
                  <p><strong>Località:</strong> {job.town} ({job.province})</p>
                  <p><strong>Urgenza:</strong> {job.urgency}</p>
                  <PhotoGallery job={job} type="before" allowUpload={false} />
                  <PhotoGallery job={job} type="after" allowUpload={['assigned','work_done'].includes(job.status)} />
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
        <nav className="ihfy-bottom-nav" style={{
          position: 'fixed',
          bottom: 0,
          width: '100%',
          background: 'white',
          display: 'flex',
          justifyContent: 'space-around',
          padding: '16px 0'
        }}>
          {[
            { name: 'Home', icon: <House size={20} /> },
            { name: 'Richieste', icon: <ClipboardList size={20} /> },
            { name: 'Profilo', icon: <User size={20} /> }
          ].map(tab => (
            <button
              key={tab.name}
              onClick={() => {
                setActiveTab(tab.name);
                setSelectedJobId(null);
                setJobFilter('all');
                setShowForm(false);
                setMessage('');
              }}
              style={{
                border: 'none',
                background: 'none',
                color: activeTab === tab.name ? '#2563eb' : '#9aa6b5',
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
