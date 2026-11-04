const associationRouteShell = {
  name: 'association-route-shell',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      const pathname = new URL(request.url, 'http://vite.local').pathname
      const frenchRoute = /^\/associations\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/members(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?)?\/?$/
      const englishRoute = /^\/en\/associations\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/members(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?)?\/?$/

      if (frenchRoute.test(pathname)) request.url = `/associations/index.html${new URL(request.url, 'http://vite.local').search}`
      if (englishRoute.test(pathname)) request.url = `/en/associations/index.html${new URL(request.url, 'http://vite.local').search}`
      next()
    })
  },
}

export default {
  plugins: [associationRouteShell],
  build: {
    rollupOptions: {
      input: {
        home: 'index.html',
        about: 'a-propos/index.html',
        homeEnglish: 'en/index.html',
        aboutEnglish: 'en/about/index.html',
        activities: 'activites/index.html',
        activitiesEnglish: 'en/activities/index.html',
        account: 'compte/index.html',
        accountEnglish: 'en/account/index.html',
        adminAssociations: 'compte/admin/associations/index.html',
        adminAssociationsEnglish: 'en/account/admin/associations/index.html',
        adminUsers: 'compte/admin/comptes/index.html',
        adminUsersEnglish: 'en/account/admin/users/index.html',
        association: 'associations/index.html',
        associationEnglish: 'en/associations/index.html',
      },
    },
  },
}
