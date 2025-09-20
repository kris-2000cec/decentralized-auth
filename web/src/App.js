// src/App.js
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { SiweMessage } from 'siwe';
import axios from 'axios';

// Make axios talk to your backend and send cookies
axios.defaults.baseURL = 'http://localhost:5000';
axios.defaults.withCredentials = true;

function App() {
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const signIn = async () => {
    setErr('');
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not found. Please install it and reload.');
      }

      setLoading(true);

      // Request accounts (ensures MetaMask prompt appears if not connected)
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      // Ethers v6: get chainId
      const { chainId } = await provider.getNetwork();

      // 1) Ask backend for nonce
      const { data: nonceRes } = await axios.get('/nonce');

      // 2) Build SIWE message
      const siwe = new SiweMessage({
        domain: window.location.hostname,      // "localhost" (no port)
        address: userAddress,
        statement: 'Sign in with Ethereum to our app.',
        uri: window.location.origin,           // http://localhost:3000
        version: '1',
        chainId: Number(chainId),
        nonce: nonceRes.nonce,
        issuedAt: new Date().toISOString(),
      });

      // 3) User signs the message
      const signature = await signer.signMessage(siwe.prepareMessage());

      // 4) Send to backend to verify (and set cookie)
      const { data: verifyRes } = await axios.post('/verify', {
        message: siwe.toMessage(),
        signature,
        id: nonceRes.id
      });

      if (!verifyRes.ok) throw new Error('Verification failed');

      setAddress(verifyRes.address ?? userAddress);
    } catch (e) {
      setErr(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };



  //function of logout

  const handleLogout = async () => {
  await fetch('http://localhost:5000/logout', {
    method: 'POST',
    credentials: 'include',
  });
  localStorage.removeItem('siweSession');
  setAddress(null);
};


//to stay in login state even if tab refreshed
useEffect(() => {
  const checkSession = async () => {
    const res = await fetch('http://localhost:5000/me', {
      credentials: 'include',
    });
    const data = await res.json();
    if (data.address) {
      setAddress(data.address);
      localStorage.setItem('siweSession', data.address);
    }
  };
  checkSession();
}, []);





  return (
    <div style={{ maxWidth: 560, margin: '80px auto', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Sign-In With Ethereum</h1>

      {!address ? (
        <button onClick={signIn} disabled={loading} style={{ padding: '10px 16px', fontSize: 16 }}>
          {loading ? 'Signing…' : 'Connect wallet & sign'}
        </button>
      ) : (
        <>
        <h2>HI KRIS</h2>
          <p>Connected as: <code>{address}</code></p>
          
        </>
      )}

     
      {address && (      //the logout button

            

  <div>
    
    <button onClick={handleLogout}>Logout</button>
  </div>
)}


      {err && <p style={{ color: 'crimson', marginTop: 16 }}>{err}</p>}
    </div>
  );
}

export default App;
