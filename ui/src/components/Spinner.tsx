/** Tiny inline spinner. Uses its own keyframes since the host Tailwind sheet is precompiled. */
export function Spinner({ size = 12 }: { size?: number }) {
  return (
    <>
      <style>{`@keyframes hs-spin { to { transform: rotate(360deg); } }`}</style>
      <span
        aria-hidden
        className="inline-block rounded-full"
        style={{
          width: size,
          height: size,
          border: '2px solid var(--border)',
          borderTopColor: 'var(--accent)',
          animation: 'hs-spin 0.8s linear infinite',
        }}
      />
    </>
  )
}
