import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Therapy Session Manager',
  description: 'AI-powered therapy session management with RAG',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-gray-50">
          <nav className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-bold text-primary">
                    Therapy Session Manager
                  </h1>
                </div>
                <div className="flex items-center space-x-4">
                  <a href="/" className="text-gray-700 hover:text-primary">
                    Sessions
                  </a>
                  <a href="/transcribe" className="text-gray-700 hover:text-primary">
                    Transcribe
                  </a>
                  <a href="/search" className="text-gray-700 hover:text-primary">
                    Search
                  </a>
                </div>
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

