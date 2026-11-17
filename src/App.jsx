
import { useEffect, useState } from 'react';
import { Search, Briefcase, Menu, User, LogOut } from 'lucide-react';
import { supabase } from './supabase';

export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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

      if (error) {
        console.error('Errore profilo:', error.message);
      }

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

  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
    }
  }

  if (loading) {
    return <div style={{ padding: 30 }}>Caricamento IHFY...</div>;
  }

  const role = profile?.role;

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
          <button onClick={logout}>
            <LogOut size={20} /> Esci
          </button>
        ) : (
          <Menu size={26} />
        )}
      </header>

      <main style={{ padding: 24 }}>
        {!session ? (
          <>
            <h2>Trova il professionista giusto</h2>
            <p>La tua rete di professionisti di fiducia.</p>
            <p>Accedi per utilizzare tutte le funzionalità di IHFY.</p>
          </>
        ) : !profile ? (
          <>
            <h2>Benvenuto su IHFY!</h2>
            <p>Non riusciamo ancora a trovare il tuo profilo.</p>
            <p>Controlla la tabella profiles su Supabase.</p>
          </>
        ) : role === 'client' ? (
          <>
            <h2>Ciao {profile.full_name || 'Cliente'}!</h2>
            <p>Benvenuto nella tua area personale.</p>
            <h3>La tua Dashboard Cliente</h3>
            <div style={{
              background: '#fff',
              padding: 20,
              borderRadius: 12,
              marginTop: 20
            }}>
              <User color="#2563eb" size={28} />
              <p>Ruolo: Cliente</p>
              <p>Email: {session.user.email}</p>
              <p>Da qui potrai gestire le tue richieste di lavoro.</p>
            </div>
          </>
        ) : role === 'artisan' ? (
          <>
            <h2>Ciao {profile.full_name || 'Artigiano'}!</h2>
            <p>Benvenuto nella tua area professionale.</p>
            <h3>Dashboard Artigiano</h3>
          </>
        ) : (
          <>
            <h2>Benvenuto su IHFY!</h2>
            <p>Ruolo non ancora riconosciuto: {role || 'non impostato'}</p>
          </>
        )}

        {session && profile && (
          <>
            <h3 style={{ marginTop: 30 }}>Esplora le categorie</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 15
            }}>
              {['Idraulici', 'Elettricisti', 'Imbianchini', 'Giardinieri'].map(item => (
                <div key={item} style={{
                  background: '#fff',
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
      </main>

      <nav style={{
        position: 'fixed',
        bottom: 0,
        width: '100%',
        background: '#fff',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '16px 0'
      }}>
        {['Home', 'Cerca', 'Preferiti', 'Profilo'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              border: 'none',
              background: 'none',
              color: activeTab === tab ? '#2563eb' : '#777',
              fontWeight: 'bold'
            }}
          >
            {tab}
          </button>
        ))}
      </nav>
    </div>
  );
}
