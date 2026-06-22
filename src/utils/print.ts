/**
 * Cross-platform print: uses a hidden iframe so Android Chrome doesn't block it.
 * window.open('', '_blank') gets blocked by Android's popup blocker;
 * iframe + srcdoc avoids that and calls print() on the iframe's own window.
 */
export function printDocument(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;';
  document.body.appendChild(iframe);

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 1000);
  };

  iframe.srcdoc = html;
}
