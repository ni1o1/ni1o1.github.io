# ni1o1

This project is a web application built with React and Vite. It utilizes various libraries for UI components, data visualization, and routing.

## Project Structure

- `src/`: Contains the main source code for the React application.
- `public/`: Contains static assets that are copied directly to the build output.
- `docs/`: Contains the built application files, intended for deployment (e.g., GitHub Pages).

## Key Technologies

- **Framework:** React
- **Build Tool:** Vite
- **UI Library:** Ant Design (`antd`, `@ant-design/pro-components`)
- **Routing:** React Router DOM (`react-router-dom`)
- **Data Visualization:**
    - Deck.gl (`deck.gl`, `react-map-gl`)
    - ECharts (`echarts`, `echarts-for-react`)
- **Internationalization:** i18next (`i18next`, `react-i18next`)
- **HTTP Client:** Axios (`axios`)
- **Linting:** ESLint

## Available Scripts

In the project directory, you can run:

### `npm install` or `yarn install`

Installs the project dependencies.

### `npm run dev` or `yarn dev`

Runs the app in development mode using Vite.
Open [http://localhost:5173](http://localhost:5173) (or the port specified by Vite) to view it in the browser.

The page will reload if you make edits.
You will also see any lint errors in the console.

### `npm run build` or `yarn build`

Builds the app for production to the `dist` folder.
It correctly bundles React in production mode and optimizes the build for the best performance.
The build command also removes the existing `docs` folder and renames the `dist` folder to `docs`, preparing it for deployment (e.g., GitHub Pages).

### `npm run lint` or `yarn lint`

Lints the project files using ESLint.

### `npm run preview` or `yarn preview`

Serves the production build locally using Vite's preview server. This is useful for checking the production build before deployment.

## License

This project is licensed under the MIT License. See the `package.json` file for details.
