  const clientProfiles = [
    { name: "default-direct", extractorArgs: null, useCookies: false },
    { name: "mweb-direct", extractorArgs: "youtube:player_client=mweb", useCookies: false },
    { name: "web-mweb-direct", extractorArgs: "youtube:player_client=web,mweb", useCookies: false },
    { name: "tv-direct", extractorArgs: "youtube:player_client=tv", useCookies: false },
    { name: "ios-direct", extractorArgs: "youtube:player_client=ios", useCookies: false },
    { name: "default-cookies", extractorArgs: null, useCookies: true },
    { name: "mweb-cookies", extractorArgs: "youtube:player_client=mweb", useCookies: true },
    { name: "web-cookies", extractorArgs: "youtube:player_client=web,mweb", useCookies: true },
    { name: "ios-cookies", extractorArgs: "youtube:player_client=ios", useCookies: true },
    { name: "android-cookies", extractorArgs: "youtube:player_client=android,ios,web", useCookies: true }
  ];
