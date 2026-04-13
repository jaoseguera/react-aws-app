import { useAuth } from 'react-oidc-context'
import { useEffect, useState } from 'react'
import './App.css'

const API_URL = "https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/dev"

function App() {
  const auth = useAuth()
  const [rights, setRights] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if(!auth.isAuthenticated) return

    const fetchRights = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_URL}/user-rights`, {
          headers: {
            Authorization: `Bearer ${auth.user?.access_token}`
          }
        })
        const data = await response.json()
        setRights(data.rights ?? [])
      } catch (err) {
        console.error("Failed to fetch rights", err)
      } finally {
        setLoading(false)
    }
  }
    fetchRights()
  }, [auth.isAuthenticated])

if(auth.isLoading) return <div>Loading...</div>
if(auth.error) return <div>Oops... {auth.error.message}</div>

if(!auth.isAuthenticated) {
  return (
    <div style={{ padding: '2rem'}}>
      <h1>React App!</h1>
      <button onClick={() => auth.signinRedirect()}>Sign in</button>
    </div>
  )
}

return (
    <div style={{ padding: '2rem'}}>
      <h1>Welcome {auth.user?.profile.email}!</h1>
      <h2>Your rights:</h2>
      {loading ? (
        <p>Loading rights...</p>
      ) : (
        <ul>
          {rights.map((right, index) => (
            <li key={index}>{right}</li>
          ))}
        </ul>
      )}
      <button onClick={() => {
        auth.removeUser()
        window.location.href = "https://react-app-[ENVIRONMENT]-XXXXXX.auth.us-east-1.amazoncognito.com" +
          "/logout?client_id=[CLIENT_ID]&logout_uri=http://localhost:5173"
      }}>
        Sign out
      </button>
    </div>
  )
}

export default App
