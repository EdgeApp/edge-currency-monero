# mymonero

This folder contains a forked copy of the mymonero-core-js v1.1.2 source code.

Changes include:

- Make various methods async to match react-native-mymonero-core's API.
- Accept the react-native-mymonero-core API via dependency injection.
- Use the `fetch` API in the `HTTPRequest` method.

The `HostedMoneroAPIClient` folder includes code taken mymonero app, which the core API depends on.

Finally, this folder packages all of this functionality together into a `MyMoneroApi` class, which provides a simpler high-level interface to these libraries.
