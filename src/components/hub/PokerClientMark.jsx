// The existing client uses a code-native P / ParaPoker wordmark, not an image logo.
export function PokerClientMark() {
  return (
    <span className="poker-client-mark" aria-hidden="true">
      <b>P</b>
      <span>
        ParaPoker<small>PLAY-MONEY / PRELAUNCH</small>
      </span>
    </span>
  );
}
