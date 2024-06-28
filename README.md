# WebSQL Polyfill

This project provides a WebSQL polyfill using SQL.js, allowing you to use WebSQL-like functionality in browsers that don't natively support it.

## Features

- WebSQL API polyfill
- Built with SQL.js for SQLite functionality
- Webpack configuration for bundling and optimization
- Development server with hot reloading

## Prerequisites

- Node.js (version 12 or higher recommended)
- npm (comes with Node.js)

## Installation

1. Clone the repository:
`git clone https://github.com/your-username/websql-polyfill.git
cd websql-polyfill`

2. Install dependencies:
`npm install`

## Usage

### Development

To run the development server:
`npm start`

This will start a development server at `http://localhost:9000` with hot reloading enabled.

### Production Build

To create a production build:
`npm run build`

This will generate optimized files in the `websql-polyfill` directory.

### Serving Production Build

To serve the production build:
`npm run serve`
This will serve the production build at `http://localhost:3020`.

## Project Structure

- `src/index.js`: Main entry point of the application
- `src/index.html`: HTML template
- `webpack.config.js`: Webpack configuration file
- `package.json`: Project metadata and dependencies

## Dependencies

- `sql.js`: SQLite compiled to JavaScript
- `localforage`: Offline storage library
- `sqlocal`: SQLite wrapper for LocalForage

## Dev Dependencies

- Webpack and related plugins for bundling and optimization
- Babel for JavaScript transpilation
- Worker loader for Web Worker support

## License

This project is licensed under the ISC License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any problems or have any questions, please open an issue in the GitHub repository.
