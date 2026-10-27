export default {
  build: {
    rollupOptions: {
      input: {
        home: 'index.html',
        about: 'a-propos/index.html',
        homeEnglish: 'en/index.html',
        aboutEnglish: 'en/about/index.html',
        activities: 'activites/index.html',
        activitiesEnglish: 'en/activities/index.html',
      },
    },
  },
}
