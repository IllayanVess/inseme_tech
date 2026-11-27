import './style.css'
import { initializeActivitiesPage } from './features/activities/activities-page.js'
import { initializeAboutPage } from './features/about/about-page.js'
import { initializeMobileNavigation } from './features/navigation/mobile-navigation.js'
import { initializeHomepageContent } from './features/home/homepage-content.js'
import { initializeAccountPage } from './features/account/account-page.js'
import { initializeAssociationPage } from './features/association/association-page.js'
import { initializeAdminAssociationsPage } from './features/account/admin-associations-page.js'
import { initializeAdminUsersPage } from './features/account/admin-users-page.js'
import { initializeAiWatchPage } from './features/watch/ai-watch-page.js'
import { initializeEventsPage } from './features/events/events-page.js'

initializeAboutPage()
initializeActivitiesPage()
initializeMobileNavigation()
initializeHomepageContent()
initializeAccountPage()
initializeAssociationPage()
initializeAdminAssociationsPage()
initializeAdminUsersPage()
initializeAiWatchPage()
initializeEventsPage()

if (document.querySelector('[data-data-centers-page]')) {
  import('./features/data-centers/data-centers-page.js')
    .then(({ initializeDataCentersPage }) => initializeDataCentersPage())
    .catch((error) => console.error('Could not initialize the data-centre map:', error))
}
