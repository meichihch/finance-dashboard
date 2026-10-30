import { useState } from 'react'
import Layout from './components/Layout'
import BudgetPage from './pages/BudgetPage'
import ImportPage from './pages/ImportPage'
import IncomePage from './pages/IncomePage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import { useFinanceStore } from './store/useFinanceStore'
import { useAuth } from './hooks/useAuth'
import { cloudEnabled } from './lib/supabase'

function Splash({ text }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <p className="text-sm text-zinc-500">{text}</p>
    </div>
  )
}

export default function App() {
  const auth = useAuth()
  if (!auth.ready) return <Splash text="Loading…" />
  if (cloudEnabled && !auth.user) return <LoginPage signIn={auth.signIn} />
  return <Dashboard user={auth.user} signOut={auth.signOut} />
}

function Dashboard({ user, signOut }) {
  const [page, setPage] = useState('dashboard')
  const store = useFinanceStore(user)


  function renderPage() {
    switch (page) {
      case 'dashboard':
        return (
          <DashboardPage
            transactions={store.transactions}
            budgetCategories={store.budgetCategories}
            settings={store.settings}
          />
        )
      case 'budget':
        return (
          <BudgetPage
            budgetCategories={store.budgetCategories}
            transactions={store.transactions}
            settings={store.settings}
            addBudgetCategory={store.addBudgetCategory}
            updateBudgetCategory={store.updateBudgetCategory}
            deleteBudgetCategory={store.deleteBudgetCategory}
            updateTransaction={store.updateTransaction}
            deleteTransaction={store.deleteTransaction}
            updateSettings={store.updateSettings}
            goalChecks={store.goalChecks ?? {}}
            toggleGoalCheck={store.toggleGoalCheck}
          />
        )
      case 'import':
        return (
          <ImportPage
            settings={store.settings}
            addTransaction={store.addTransaction}
            transactions={store.transactions}
            recurringExpenses={store.recurringExpenses ?? []}
            addRecurring={store.addRecurring}
            updateRecurring={store.updateRecurring}
            deleteRecurring={store.deleteRecurring}
          />
        )
      case 'income':
        return (
          <IncomePage
            settings={store.settings}
            addTransaction={store.addTransaction}
            transactions={store.transactions}
            recurringIncomes={store.recurringIncomes ?? []}
            addRecurringIncome={store.addRecurringIncome}
            updateRecurringIncome={store.updateRecurringIncome}
            deleteRecurringIncome={store.deleteRecurringIncome}
            updateTransaction={store.updateTransaction}
            deleteTransaction={store.deleteTransaction}
          />
        )
      default:
        return null
    }
  }

  if (!store.ready) {
    return <Splash text={store.cloud.status === 'error' ? `Couldn't load your data: ${store.cloud.error}` : 'Loading your data…'} />
  }

  return (
    <Layout page={page} setPage={setPage} cloud={store.cloud} user={user} signOut={signOut}>
      {renderPage()}
    </Layout>
  )
}
