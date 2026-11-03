import { useEffect, useState } from 'react';
import { Platform, Text } from 'react-native';

import { Button, Card, text } from '@/components/ui';

const DISMISS_KEY = 'install_hint_dismissed';

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Nur Web: Hinweis, die Web-App auf den Home-Bildschirm zu legen, damit sie wie
 * eine richtige App startet. Android/Chrome bekommt einen Installieren-Button,
 * iPhone/Safari eine kurze Anleitung (dort gibt es keinen Button).
 */
export function InstallHint() {
  const [visible, setVisible] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || isStandalone()) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {}
    if (dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    // Auf dem iPhone gibt es kein Install-Ereignis, dort direkt die Anleitung zeigen.
    const timer = setTimeout(() => {
      if (isIos()) setVisible(true);
    }, 0);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {}
    setVisible(false);
  }

  return (
    <Card>
      <Text style={text.heading}>Als App auf dem Home-Bildschirm</Text>
      {installEvent ? (
        <>
          <Text style={text.body}>Leg die Stempelkarte auf deinen Home-Bildschirm, dann hast du sie immer griffbereit.</Text>
          <Button
            title="App installieren"
            onPress={async () => {
              await installEvent.prompt();
              dismiss();
            }}
          />
        </>
      ) : (
        <Text style={text.body}>
          Tippe in Safari unten auf „Teilen“ (Quadrat mit Pfeil nach oben) und dann auf „Zum Home-Bildschirm“. So
          startet die Stempelkarte wie eine richtige App.
        </Text>
      )}
      <Button title="Nicht mehr anzeigen" variant="secondary" onPress={dismiss} />
    </Card>
  );
}
