import { useDisplayKiosk } from '../hooks/useDisplayKiosk';

/** Corner fullscreen control for tablet door / lobby displays */
export function DisplayKioskControls() {
  const {
    isFullscreen,
    showPrompt,
    enterFullscreen,
    toggleFullscreen,
    dismissPrompt,
  } = useDisplayKiosk();

  return (
    <div className="kiosk-controls">
      {showPrompt && (
        <div className="kiosk-controls__prompt" role="status">
          <button type="button" onClick={() => void enterFullscreen()}>
            Fullscreen
          </button>
          <button
            type="button"
            className="kiosk-controls__dismiss"
            onClick={dismissPrompt}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      <button
        type="button"
        className="kiosk-controls__toggle"
        onClick={() => void toggleFullscreen()}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? '⤡' : '⛶'}
      </button>
    </div>
  );
}
