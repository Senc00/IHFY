
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
  }, [session, profile]);

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
          <>
            <h2>Trova il professionista giusto</h2>
            <p>La tua rete di professionisti di fiducia.</p>
            <p>Accedi per utilizzare IHFY.</p>
          </>
        ) : !profile ? (
          <h2>Profilo non trovato. Controlla Supabase.</h2>
        ) : profile.role === 'client' ? (
          <>
            <h2>Ciao {profile.full_name || 'Cliente'}!</h2>
            <p>Benvenuto nella tua area personale.</p>

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
                    <p>Stato: {job.status}</p>
                  </div>
                ))}
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
          </>
        ) : (
          <h2>Ruolo non riconosciuto: {profile.role}</h2>
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
