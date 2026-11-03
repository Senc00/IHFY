import { useState } from 'react';
import { Search, User, Briefcase, Star, Menu } from 'lucide-react';

export default function App() {
const [activeTab, setActiveTab] = useState('Home');

return (
<div style={{
fontFamily: 'Arial, sans-serif',
background: '#f7f8fa',
minHeight: '100vh',
color: '#202938'
}}>
<header style={{
background: '#ffffff',
padding: '20px',
display: 'flex',
justifyContent: 'space-between',
alignItems: 'center'
}}>
<h1 style={{ color: '#2563eb', margin: 0 }}>IHFY</h1>
<Menu size={26} />
</header>

<main style={{ padding: '24px' }}>
<h2>Trova il professionista giusto</h2>
<p>La tua rete di professionisti di fiducia.</p>

<div style={{
background: 'white',
padding: '15px',
borderRadius: '12px',
display: 'flex',
gap: '10px',
alignItems: 'center'
}}>
<Search />
<input
placeholder="Cosa stai cercando?"
style={{ border: 'none', outline: 'none', flex: 1 }}
/>
</div>

<h3 style={{ marginTop: '30px' }}>Esplora le categorie</h3>

<div style={{
display: 'grid',
gridTemplateColumns: '1fr 1fr',
gap: '15px'
}}>
{['Idraulici', 'Elettricisti', 'Imbianchini', 'Giardinieri'].map(item => (
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
