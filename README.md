# Palace
Visual chat app built with electron@beta


## Releases
[Go to the releases page](https://github.com/pawnipt/Palace/releases)


## Building

First you will want to install [Git](https://git-scm.com/downloads) and also [Node](https://nodejs.org/en/)

You will then want to clone Palace's source to your working directory:
```
git clone https://github.com/pawnipt/Palace.git
```

Then you must install electron@beta with the command line
```
npm install electron@beta --save-dev
```
There are also a few dependencies
```
npm install electron-packager --save-dev
```
```
npm install electron-rebuild --save-dev
```
```
npm install electron-spellchecker
```
If you're on Windows installing spellchecker may require that windows-build-tools is installed
```
npm install --global windows-build-tools
```


After installing any node module you will want to run the rebuild script defined in package.json

Mac:
```
npm run rebuild
```
Windows:
```
npm run rebuild-win32
```

### Finally
```
npm run start
```
or
```
npm run build
```
