import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { linkHandler, navigate, useLocation } from '@/lib/navigate'

function Where() {
  const { path, hash } = useLocation()
  return (
    <>
      <p>{path + hash}</p>
      <a href="/tools/x" onClick={linkHandler('/tools/x')}>
        go
      </a>
    </>
  )
}

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

describe('navigate / useLocation', () => {
  it('updates subscribers without a page load', () => {
    render(<Where />)
    act(() => navigate('/tools/bpm-key-finder'))
    expect(screen.getByText('/tools/bpm-key-finder')).toBeInTheDocument()
    act(() => navigate('/'))
    expect(screen.getByText('/')).toBeInTheDocument()
  })

  it('follows back/forward (popstate) and hash changes', () => {
    render(<Where />)
    act(() => {
      window.history.pushState(null, '', '/s/abc#/privacy')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByText('/s/abc#/privacy')).toBeInTheDocument()
  })

  it('link clicks navigate in-app, but modifier clicks are left to the browser', () => {
    render(<Where />)
    const link = screen.getByText('go')
    fireEvent.click(link, { ctrlKey: true })
    expect(window.location.pathname).toBe('/')
    fireEvent.click(link)
    expect(window.location.pathname).toBe('/tools/x')
  })
})
