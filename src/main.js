import './style.css'
import { initializeActivitiesPage } from './features/activities/activities-page.js'
import { initializeAboutPage } from './features/about/about-page.js'
import { initializeMobileNavigation } from './features/navigation/mobile-navigation.js'
import { initializeHomepageContent } from './features/home/homepage-content.js'

initializeAboutPage()
initializeActivitiesPage()
initializeMobileNavigation()
initializeHomepageContent()
