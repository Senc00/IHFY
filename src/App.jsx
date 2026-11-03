import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Search, Briefcase, User, Star } from 'lucide-react';

export default function App() {
const [activeTab, setActiveTab] = useState('Home');
const [search, setSearch] = useState('');
const [jobs, setJobs] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
async function loadJobs() {
const { data, error } = await supabase
.from('jobs')
.select('*');

if (error) {
console.error('Errore Supabase:', error.message);
} else {
setJobs(data || []);
}

setLoading(false);
}

loadJobs();
}, []);

const categories = [
'Idraulici',
'Elettricisti',
'Imbianchini',
'Giardinieri'
];

return (
<div style={{
fontFamily: 'Arial, sans-serif',
background: '#f7f8fa',
minHeight: '100vh',
color: '#202938',
paddingBottom: '80px'
}}>
<header style={{
background: 'white',
padding: '20px',
display: 'flex',
justifyContent: 'space-between'
}}>
<h1 style={{ color: '#2563eb', margin: 0 }}>IHFY</h1>
<User size={26} />
</header>

<main style={{ padding: '24px' }}>
<h2>Trova il professionista giusto</h2>
<p>La tua rete di professionisti di fiducia.</p>

<div style={{
background: 'white',
padding: '15px',
borderRadius: '12px',
display: 'flex',
gap: '10px'
}}>
<Search />
<input
value={search}
onChange={e => setSearch(e.target.value)}
placeholder="Cosa stai cercando?"
style={{ border: 'none', outline: 'none', flex: 1 }}
/>
</div>

<h3>Esplora le categorie</h3>

<div style={{
display: 'grid',
gridTemplateColumns: '1fr 1fr',
gap: '15px'
}}>
{categories.map(item => (
<div key={item} style={{
background: 'white',
padding: '22px',
borderRadius: '14px',
textAlign: 'center'
}}>
<Briefcase size={28} color="#2563eb" />
<p>{item}</p>
</div>
))}
</div>

<h3>Ultime richieste di lavoro</h3>

{loading ? (
<p>Caricamento...</p>
) : jobs.length === 0 ? (
<p>Nessuna richiesta disponibile al momento.</p>
) : (
jobs
.filter(job =>
JSON.stringify(job).toLowerCase().includes(search.toLowerCase())
)
.map(job => (
<div key={job.id} style={{
background: 'white',
padding: '16px',
borderRadius: '12px',
marginBottom: '12px'
}}>
<strong>{job.title || 'Richiesta di lavoro'}</strong>
<p>{job.description || ''}</p>
</div>
))
)}
</main>

<nav style={{
position: 'fixed',
bottom: 0,
width: '100%',
background: 'white',
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
