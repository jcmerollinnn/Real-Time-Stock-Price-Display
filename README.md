# 📈 Stock Tracker

A real-time stock tracker application with ML-powered predictions. This app allows users to monitor stock prices and view predictions based on historical data.

![Stock Tracker Screenshot](https://github.com/jcmerollinnn/lightreach/blob/master/Screenshot%202025-11-28%20133712.png)
![Stock Tracker Screenshot](https://github.com/jcmerollinnn/lightreach/blob/master/Screenshot%202025-11-28%20133716.png)


---

## Features

- Real-time stock price tracking
- Interactive stock cards
- Price charts with historical data
- ML-powered price predictions
- Dark/light mode toggle
- Responsive design

---

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Docker (optional, for containerized deployment)

---

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/stock-tracker.git
   cd stock-tracker
2. Install dependencies:
   ```
   npm install
3. Set up environment variables:
   ```
   cp .env.example .env
4. Edit the .env file with your API keys:
   ```
   REACT_APP_ALPHA_VANTAGE_KEY=your_alpha_vantage_key
   REACT_APP_FINNHUB_KEY=your_finnhub_key
   REACT_APP_USE_MOCK=false
   REACT_APP_ALPHA_VANTAGE_URL=https://www.alphavantage.co/query
   REACT_APP_FINNHUB_URL=https://finnhub.io/api/v1
## Sign up for free API keys:
* [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
* [Finnhub](https://finnhub.io/)

## 🏃 Running the Application
Development Mode
   ```
   npm start
   ```
Production Mode
1. Build the application:
   ```
   npm run build
2. Serve the built application:
   ```
   npm install -g serve
   serve -s build
## Docker (Optional)

1. Build the Docker image:
   ```
   docker build -t stock-tracker-app .
2. Run the Docker container:
   ```
   docker run -p 3000:3000 --env-file .env stock-tracker-app
## 💻 Usage
1. Select a stock symbol from the dropdown menu.
2. Click "Add" to start tracking the stock.
3. Click on any stock card to view its price chart.
4. Toggle predictions on/off using the "Predictions" button.
5. Use the dark/light mode toggle for better visibility.

## 📦 Dependencies
* React
* Recharts (for charts)
* Lucide React (for icons)
* TypeScript

## 🤝 Contributing
Contributions are welcome! Please follow these steps:

## 1. Fork the repository.
## 2. Create a new branch:
```
git checkout -b feature-branch
```
## 3. Make your changes.
```
git commit -m 'Add some feature'
```
## 4. Push to the branch 
```
git push origin feature-branch
```
## 5. Open a pull request.

## 📄 License
This project is licensed under the MIT License.

## 📧 Contact
For questions or feedback, please contact bayocotjuancarlos@gmail.com
