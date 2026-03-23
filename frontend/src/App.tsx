import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import FridgePage from './pages/FridgePage';
import RecommendPage from './pages/RecommendPage';
import RecipeDetailPage from './pages/RecipeDetailPage';
import ShoppingPage from './pages/ShoppingPage';
import ProfilePage from './pages/ProfilePage';
import MyRipePage from './pages/MyRipePage';

function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            borderRadius: '16px',
            fontFamily: "'Noto Sans KR', sans-serif",
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#10B981', secondary: 'white' },
          },
          error: {
            iconTheme: { primary: '#EF4444', secondary: 'white' },
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Layout><HomePage /></Layout>} />
        <Route path="/fridge" element={<Layout><FridgePage /></Layout>} />
        <Route path="/recommend" element={<Layout><RecommendPage /></Layout>} />
        <Route path="/recipe/:id" element={<Layout><RecipeDetailPage /></Layout>} />
        <Route path="/shopping" element={<Layout><ShoppingPage /></Layout>} />
        <Route path="/profile" element={<Layout><ProfilePage /></Layout>} />
        <Route path="/myripe" element={<Layout><MyRipePage /></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
