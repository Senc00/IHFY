import React, { useState } from 'react';
import { supabase } from './supabase';
import './index.css';

export default function App() {
const [mode, setMode] = useState('login');
const [role, setRole] = useState('cliente');
const [fullName, setFullName] = useState('');
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [message, setMessage] = useState('');
const [loading, setLoading] = useState(false);

async function handleSubmit(e) {
e.preventDefault();
setMessage('');
setLoading(true);

try {
if (mode === 'register') {
const { error } = await supabase.auth.signUp({
email,
password,
options: {
data: {
full_name: fullName,
role: role
}
}
});

if (error) throw error;

setMessage(
'Registrazione completata! Controlla la tua email per confermare l’account.'
);
} else {
const { error } = await supabase.auth.signInWithPassword({
email,
password
});

if (error) throw error;

setMessage('Accesso effettuato con successo!');
}
} catch (error) {
setMessage(error.message);
} finally {
setLoading(false);
}
}

return (
<main style={{
minHeight: '100vh',
background: '#f4f7f5',
padding: '30px 16px',
fontFamily: 'Arial, sans-serif'
}}>
<div style={{
maxWidth: '430px',
margin: '40px auto',
background: 'white',
padding: '30px',
borderRadius: '18px',
boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
}}>
<h1 style={{
textAlign: 'center',
color: '#168653',
fontSize: '38px',
marginBottom: '5px'
}}>
IHFY
</h1>

<p style={{ textAlign: 'center', color: '#666' }}>
Trova il professionista giusto per te
</p>

<h2 style={{ textAlign: 'center', marginTop: '30px' }}>
{mode === 'register' ? 'Crea il tuo account' : 'Bentornato!'}
</h2>

<form onSubmit={handleSubmit}>
{mode === 'register' && (
<>
<label>Nome e cognome</label>
<input
required
value={fullName}
onChange={e => setFullName(e.target.value)}
placeholder="Il tuo nome"
style={inputStyle}
/>

<label>Seleziona il tuo profilo</label>
<select
value={role}
onChange={e => setRole(e.target.value)}
style={inputStyle}
>
<option value="cliente">Sono un cliente</option>
<option value="artigiano">Sono un artigiano</option>
</select>
</>
)}

<label>Email</label>
<input
type="email"
required
value={email}
onChange={e => setEmail(e.target.value)}
placeholder="nome@email.it"
style={inputStyle}
/>

<label>Password</label>
<input
type="password"
required
minLength={6}
value={password}
onChange={e => setPassword(e.target.value)}
placeholder="Almeno 6 caratteri"
style={inputStyle}
/>

<button
type="submit"
disabled={loading}
style={{
width: '100%',
padding: '14px',
marginTop: '20px',
background: '#168653',
color: 'white',
border: 'none',
borderRadius: '10px',
fontSize: '16px',
cursor: 'pointer'
}}
>
{loading
? 'Attendere...'
: mode === 'register'
? 'Registrati'
: 'Accedi'}
</button>
</form>

{message && (
<p style={{
marginTop: '20px',
textAlign: 'center',
color: message.includes('successo') ||
message.includes('completata')
? 'green'
: 'red'
}}>
{message}
</p>
)}

<p style={{ textAlign: 'center', marginTop: '25px' }}>
{mode === 'register'
? 'Hai già un account?'
: 'Non hai ancora un account?'}
{' '}
<button
onClick={() => {
setMode(mode === 'register' ? 'login' : 'register');
setMessage('');
}}
style={{
border: 'none',
background: 'none',
color: '#168653',
fontWeight: 'bold',
cursor: 'pointer'
}}
>
{mode === 'register' ? 'Accedi' : 'Registrati'}
</button>
</p>
</div>
</main>
);
}

const inputStyle = {
width: '100%',
padding: '12px',
marginTop: '7px',
marginBottom: '18px',
border: '1px solid #ddd',
borderRadius: '8px',
boxSizing: 'border-box',
fontSize: '15px'
};
