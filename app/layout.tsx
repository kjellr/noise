import type { Metadata } from 'next'
import { DM_Mono, Instrument_Serif, Inter, UnifrakturMaguntia, Playwrite_DE_SAS } from 'next/font/google'
import './globals.css'

const dmMono = DM_Mono({
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-mono',
})

const instrumentSerif = Instrument_Serif({
  weight: ['400'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-serif',
})

const inter = Inter({
  weight: ['300', '700'],
  subsets: ['latin'],
  variable: '--font-inter',
})

const unifraktur = UnifrakturMaguntia({
  weight: ['400'],
  subsets: ['latin'],
  variable: '--font-unifraktur',
})

const playwriteDeSas = Playwrite_DE_SAS({
  weight: ['400'],
  variable: '--font-playwrite-de-sas',
})

export const metadata: Metadata = {
  title: 'Noise — Dither Studio',
  description: 'Dither any image with classic and modern algorithms',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmMono.variable} ${instrumentSerif.variable} ${inter.variable} ${unifraktur.variable} ${playwriteDeSas.variable} h-full`}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  )
}
