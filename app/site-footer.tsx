import Image from 'next/image';
import Link from 'next/link';

type SiteFooterProps = {
  homeBrandTarget?: '/' | '#top';
};

export function SiteFooter({ homeBrandTarget = '/' }: SiteFooterProps) {
  const brand = (
    <>
      <Image src="/footer-wordmark-star.png" alt="Force Against Something" width={620} height={99} unoptimized />
    </>
  );

  return (
    <footer>
      {homeBrandTarget === '#top' ? (
        <a className="brand footer-brand" href="#top" aria-label="Force Against Something home">
          {brand}
        </a>
      ) : (
        <Link className="brand footer-brand" href="/" aria-label="Force Against Something home">
          {brand}
        </Link>
      )}
      <p>Pick an issue. Do your part.</p>
      <div>
        <Link href="/contact">Contact</Link>
        <Link href="/government">Your Government</Link>
        <Link href="/api">API</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/submit">Submit an action</Link>
      </div>
    </footer>
  );
}
