import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import PrivateRoute from './components/PrivateRoute'
import RecipeList from './pages/RecipeList'
import MyRecipes from './pages/MyRecipes'
import RecipeDetail from './pages/RecipeDetail'
import RecipeForm from './pages/RecipeForm'
import Login from './pages/Login'
import Register from './pages/Register'
import NotFound from './pages/NotFound'
import AiRecipeManager from './components/AiRecipeManager'

function App() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      {/* max-w מוגדר כאן ולא על <main>, כך שעמוד יכול לרנדר רצועה במלוא הרוחב
          (ה-hero של עמוד המתכון) בלי טריקים של margin שלילי ו-100vw (M5) */}
      <main>
        <Routes>
          <Route path="/" element={<Page><RecipeList /></Page>} />
          <Route path="/login" element={<Page><Login /></Page>} />
          <Route path="/register" element={<Page><Register /></Page>} />
          <Route path="/ai" element={<Page><AiRecipeManager /></Page>} />
          <Route
            path="/my-recipes"
            element={
              <PrivateRoute>
                <Page><MyRecipes /></Page>
              </PrivateRoute>
            }
          />
          {/* עמוד המתכון מנהל את הרוחב בעצמו - ה-hero חורג במכוון */}
          <Route path="/recipes/:id" element={<RecipeDetail />} />
          <Route
            path="/recipes/new"
            element={
              <PrivateRoute>
                <Page><RecipeForm /></Page>
              </PrivateRoute>
            }
          />
          <Route
            path="/recipes/:id/edit"
            element={
              <PrivateRoute>
                <Page><RecipeForm /></Page>
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Page><NotFound /></Page>} />
        </Routes>
      </main>
    </div>
  )
}

// עוטף עמוד "רגיל" ברוחב ובריווח הסטנדרטיים של האתר
function Page({ children }) {
  return <div className="mx-auto max-w-6xl px-6 py-12 md:px-10">{children}</div>
}

export default App
