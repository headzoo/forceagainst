import { cn, s } from '@/app/tailwind-styles';
import footerLogo from '@/assets/logo-white.png';
import Image from 'next/image';
import Link from 'next/link';

type SiteFooterProps = {
  homeBrandTarget?: '/' | '#top';
};

export function SiteFooter({ homeBrandTarget = '/' }: SiteFooterProps) {
  const brand = (
    <>
      <Image src={footerLogo} alt="Force Against" unoptimized />
    </>
  );

  return (
    <footer className={s.footer}>
      {homeBrandTarget === '#top' ? (
        <a className={cn(s.brand, s.footerBrand)} href="#top" aria-label="Force Against home">
          {brand}
        </a>
      ) : (
        <Link className={cn(s.brand, s.footerBrand)} href="/" aria-label="Force Against home">
          {brand}
        </Link>
      )}
      <p>
        <Image
          className={s.footerSticker}
          src="/i_love_vibe_coding.png"
          alt="I love vibe coding"
          width={153}
          height={60}
          unoptimized
        />
      </p>
      <div>
        <Link href="/about">About</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/government">Your Government</Link>
        <Link href="/api">API</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </div>
    </footer>
  );
}
