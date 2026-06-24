import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'My Pilates Studio',
  description: 'Gestione corsi e prenotazioni',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className={inter.className}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#fff',
              color: '#1a1a1a',
              border: '0.5px solid #e5e5e5',
              borderRadius: '8px',
              fontSize: '13px',
            },
          }}
        />
      </body>
    </html>
  )
}
