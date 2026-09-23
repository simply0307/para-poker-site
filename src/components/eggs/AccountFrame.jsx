export function AccountFrame({ title, intro, children }) {
  return <main className="eggs-page eggs-account-page"><div className="eggs-account-width">
    <p className="eggs-eyebrow">EGGS / Account</p><h1>{title}</h1>
    {intro ? <p className="eggs-intro">{intro}</p> : null}{children}
  </div></main>;
}
export function AccountUnavailable() {
  return <AccountFrame title="Your EGGS account"><p className="eggs-intro">EGGS accounts aren’t available right now. You can still explore the public projects.</p></AccountFrame>;
}
