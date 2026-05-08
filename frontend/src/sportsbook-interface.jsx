import React, { useState, useEffect, useRef } from 'react';
import { Flame, TrendingUp, DollarSign, Wallet, Check, X, ShieldAlert } from 'lucide-react';
import { fetchBetData, addBet } from './server';

const SECRET_SALT = "live_odds_v1_secure";

const generateSignature = (val) => {
    return btoa(`${parseFloat(val).toFixed(2)}:${SECRET_SALT}`);
};

const setCookie = (name, value, days = 7) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
};

const getCookie = (name) => {
    return document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, '');
};

const saveSecureBalance = (val) => {
    const sanitizedVal = Math.max(0, parseFloat(val || 0));
    const fixedVal = sanitizedVal.toFixed(2);
    const sig = generateSignature(sanitizedVal);

    localStorage.setItem('user_balance', fixedVal);
    localStorage.setItem('balance_sig', sig);
    setCookie('user_balance_sync', fixedVal);
};

const getVerifiedBalance = () => {
    const lsBal = localStorage.getItem('user_balance');
    const ckBal = getCookie('user_balance_sync');
    const sig = localStorage.getItem('balance_sig');

    if (!lsBal && !ckBal) {
        saveSecureBalance(1000.00);
        return 1000.00;
    }

    const numericBal = parseFloat(lsBal || 0);
    const expectedSig = generateSignature(numericBal);

    if (lsBal !== ckBal || sig !== expectedSig || isNaN(numericBal)) {
        console.error("Integrity Breach Detected: Resetting to default.");
        saveSecureBalance(1000.00);
        return 1000.00;
    }

    return numericBal;
};

const App = () => {
    const [markets, setMarkets] = useState([]);
    const [balance, setBalance] = useState(0);
    const [selectedBet, setSelectedBet] = useState(null);
    const [betAmount, setBetAmount] = useState('');
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        setBalance(getVerifiedBalance());
    }, []);

    const syncData = async () => {
        const liveData = await fetchBetData();
        setMarkets(liveData);

        const activeBets = JSON.parse(localStorage.getItem('active_bets') || '[]');
        if (activeBets.length > 0) {
            let currentBal = getVerifiedBalance();
            let updatedBets = [...activeBets];
            let changed = false;

            activeBets.forEach((bet) => {
                const settledMarket = liveData.find(m => m.data.title === bet.marketTitle);

                if (settledMarket && settledMarket.data.winner !== null) {
                    const winnerIdx = settledMarket.data.winner - 1;

                    if (bet.optionIndex === winnerIdx) {
                        const multiplier = parseFloat(bet.mult) || 1;
                        const payout = bet.amount * multiplier;

                        currentBal += payout;
                        triggerNotify(`WINNER: +$${payout.toFixed(2)}`, bet.marketTitle);
                    }
                    updatedBets = updatedBets.filter(b => b.timestamp !== bet.timestamp);
                    changed = true;
                }
            });

            if (changed) {
                setBalance(currentBal);
                saveSecureBalance(currentBal);
                localStorage.setItem('active_bets', JSON.stringify(updatedBets));
            }
        }
    };
    useEffect(() => {
        syncData();

        const interval = setInterval(() => {
            syncData();
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    const triggerNotify = (msg, sub) => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, msg, sub }]);
        setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
    };

    const placeBet = async () => {
        syncData();
        const amount = parseFloat(betAmount);
        const currentVerified = getVerifiedBalance();

        if (!selectedBet || isNaN(amount) || amount <= 0 || amount > currentVerified) {
            triggerNotify("Action Denied", "Check amount or balance");
            return;
        }

        const id = await addBet(selectedBet.marketId, selectedBet.optionIndex, amount);
        console.log(id);
        if (id != -1) {
            const newBal = currentVerified - amount;
            setBalance(newBal);
            saveSecureBalance(newBal);

            const activeBets = JSON.parse(localStorage.getItem('active_bets') || '[]');
            const newBetRecord = {
                ...selectedBet,
                amount,
                timestamp: Date.now()
            };
            localStorage.setItem('active_bets', JSON.stringify([...activeBets, newBetRecord]));
        }

        setSelectedBet(null);
        setBetAmount('');
        triggerNotify("Bet Placed!", `${selectedBet.optionName} @ ${selectedBet.mult}x`);
    };

    return (
        <div style={styles.container}>
            <div style={styles.hud}>
                <div style={styles.logoBox}>
                    <Flame size={24} color="#fff" />
                    <h1 style={styles.logoText}>LIVE ODDS</h1>
                    <TrendingUp size={24} color="#fff" />
                </div>

                <div style={styles.balanceDisplay}>
                    <div style={styles.balanceMeta}><Wallet size={12} /> SECURE BALANCE</div>
                    <div style={styles.balanceValue}>${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
            </div>

            <div style={styles.grid}>
                {markets.map((market, idx) => {
                    const totalPool = market.totals.reduce((sum, t) => sum + t, 0);
                    if (market.data.winner == null) {
                        return (
                            <div key={market.id || idx} style={styles.card}>
                                <h3 style={styles.cardTitle}>{market.data.title}</h3>
                                {market.data.options.map((option, optIdx) => {
                                    const percentage = totalPool > 0 ? (market.totals[optIdx] / totalPool * 100).toFixed(1) : 0;
                                    const mult = market.mults[optIdx] || 1.0;

                                    return (
                                        <div key={optIdx}
                                            onClick={() => setSelectedBet({
                                                marketId: market.id || idx,
                                                optionIndex: optIdx,
                                                marketTitle: market.data.title,
                                                optionName: option,
                                                mult
                                            })}
                                            style={styles.optionRow}>
                                            <div style={styles.optionMain}>
                                                <span style={styles.optionName}>{option}</span>
                                                <div style={styles.multBadge}>{mult.toFixed(2)}x</div>
                                            </div>
                                            <div style={styles.poolInfo}>
                                                <div style={styles.poolDetails}>
                                                    <DollarSign size={12} />
                                                    <span>${market.totals[optIdx].toLocaleString()} pool</span>
                                                    <span style={styles.pctLabel}>{percentage}%</span>
                                                </div>
                                                <div style={styles.progressTrack}>
                                                    <div style={{ ...styles.progressFill, width: `${percentage}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    }
                })}
            </div>

            {selectedBet && (
                <div style={styles.overlay}>
                    <div style={styles.modal}>
                        <div style={styles.modalHeader}>
                            <h2 style={styles.modalTitle}>PLACE WAGER</h2>
                            <button onClick={() => setSelectedBet(null)} style={styles.closeBtn}><X size={20} /></button>
                        </div>
                        <p style={styles.modalSub}>{selectedBet.marketTitle}</p>
                        <div style={styles.selectionDetail}>
                            Selected: <span style={{ color: '#00ff88' }}>{selectedBet.optionName}</span>
                        </div>
                        <div style={styles.inputWrapper}>
                            <span style={styles.inputPrefix}>$</span>
                            <input
                                type="number"
                                value={betAmount}
                                onChange={(e) => setBetAmount(e.target.value)}
                                style={styles.inputMin}
                                placeholder="0.00"
                            />
                        </div>
                        <div style={styles.payoutEst}>
                            Potential Profit: <span style={{ color: '#00ff88' }}>
                                ${((parseFloat(betAmount) || 0) * selectedBet.mult).toFixed(2) - parseFloat(betAmount)}
                            </span>
                        </div>
                        <button onClick={placeBet} style={styles.placeBtn}>CONFIRM BET</button>
                    </div>
                </div>
            )}

            <div style={styles.toastLayer}>
                {notifications.map(n => (
                    <div key={n.id} style={styles.toast}>
                        <div style={{ fontWeight: 700 }}>{n.msg}</div>
                        <div style={{ fontSize: '10px', opacity: 0.8 }}>{n.sub}</div>
                    </div>
                ))}
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
                @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes toastIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
            `}</style>
        </div>
    );
};

const styles = {
    container: { position: 'fixed', inset: 0, overflow: 'auto', background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0a0e27 100%)', padding: '20px', fontFamily: '"Space Mono", monospace', color: '#fff' },
    hud: { maxWidth: '1200px', margin: '0 auto 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' },
    logoBox: { display: 'inline-flex', alignItems: 'center', gap: '12px', background: 'linear-gradient(135deg, #ff3366, #ff6b35)', padding: '12px 24px', borderRadius: '50px', boxShadow: '0 0 40px rgba(255, 51, 102, 0.4)' },
    logoText: { margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '2px' },
    balanceDisplay: { background: 'rgba(255,255,255,0.05)', padding: '15px 25px', borderRadius: '16px', border: '1px solid rgba(0,255,136,0.2)', backdropFilter: 'blur(10px)' },
    balanceMeta: { fontSize: '10px', color: '#8892b0', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' },
    balanceValue: { fontSize: '24px', fontWeight: 700, color: '#00ff88', textShadow: '0 0 10px rgba(0,255,136,0.3)' },
    grid: { maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' },
    card: { background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(10px)', animation: 'slideIn 0.4s ease-out' },
    cardTitle: { margin: '0 0 20px 0', fontSize: '18px', borderBottom: '2px solid rgba(255,51,102,0.3)', paddingBottom: '12px' },
    optionRow: { background: 'rgba(255,51,102,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', marginBottom: '12px', cursor: 'pointer', transition: '0.2s' },
    optionMain: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
    optionName: { fontSize: '16px', fontWeight: 600 },
    multBadge: { background: 'linear-gradient(135deg, #00ff88, #00cc6a)', padding: '4px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: 800, color: '#0a0e27' },
    poolDetails: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8892b0', marginBottom: '6px' },
    pctLabel: { marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' },
    progressTrack: { width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' },
    progressFill: { height: '100%', background: 'linear-gradient(90deg, #ff3366, #ff6b35)', transition: 'width 0.5s ease' },
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { background: '#1a1f3a', border: '1px solid #ff3366', borderRadius: '24px', padding: '30px', width: '360px', boxShadow: '0 0 50px rgba(255,51,102,0.2)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' },
    modalTitle: { margin: 0, fontSize: '20px', color: '#ff3366' },
    closeBtn: { background: 'none', border: 'none', color: '#8892b0', cursor: 'pointer' },
    modalSub: { fontSize: '12px', color: '#8892b0', margin: '0 0 10px 0' },
    selectionDetail: { background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px' },
    inputWrapper: { position: 'relative', marginBottom: '10px' },
    inputPrefix: { position: 'absolute', left: '15px', top: '12px', color: '#00ff88' },
    input: { width: '100%', background: '#0a0e27', border: '1px solid #333', borderRadius: '12px', padding: '12px 12px 12px 30px', color: '#fff', fontSize: '18px', outline: 'none' },
    inputMin: { width: '87.5%', background: '#0a0e27', border: '1px solid #333', borderRadius: '12px', padding: '12px 12px 12px 30px', color: '#fff', fontSize: '18px', outline: 'none' },
    payoutEst: { fontSize: '12px', textAlign: 'center', marginBottom: '20px', color: '#8892b0' },
    placeBtn: { width: '100%', background: 'linear-gradient(135deg, #ff3366, #ff6b35)', border: 'none', borderRadius: '12px', padding: '15px', color: '#fff', fontWeight: 700, cursor: 'pointer' },
    toastLayer: { position: 'fixed', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 9999 },
    toast: { background: '#00ff88', color: '#0a0e27', padding: '15px 25px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', animation: 'toastIn 0.3s ease-out' }
};

export default App;