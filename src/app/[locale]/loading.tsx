export default function LocaleLoading() {
    return (
        <main style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <div style={{ textAlign: 'center', opacity: 0.5 }}>
                <div style={{
                    width: '32px', height: '32px',
                    border: '2px solid rgba(228,185,90,0.15)',
                    borderTopColor: 'var(--accent-gold)',
                    borderRadius: '50%',
                    margin: '0 auto',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        </main>
    )
}
