
# Group Travel Matcher ✈️

A full-stack web application built for the **Booking Holdings Hackcellence Hackathon** to help solo travellers find compatible travel companions, form groups, and plan hotel stays together.

## Features

- **Traveller Profiles:** Secure signup/login and personalized profiles.
- **Group Creation:** Create and explore travel groups.
- **Smart Matching:** Match travellers based on destination, dates, budget, interests, gender preferences, and group capacity.
- **Join Requests:** Request to join groups with creator approval.
- **Hotel Planning:** Browse hotels and select accommodations for specific dates.
- **Dynamic Cost Splitting:** Calculate hotel costs based on each member's overlapping stay dates.
- **Mock Booking:** Confirm and manage hotel selections.

## Tech Stack

- **Frontend:** React.js, Vite, JavaScript
- **Backend:** Node.js, Express.js
- **Database:** SQLite (better-sqlite3)
- **Authentication:** JWT

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/priya88983/groupTravelMatcher.git
cd groupTravelMatcher
```

### 2. Install Dependencies

```bash
npm run setup
```

### 3. Configure Environment Variables

Create a `.env` file inside the `backend` directory using `.env.example` as a reference.

Configure the required JWT secrets and other environment variables.

### 4. Seed the Database

```bash
cd backend
npm run seed
cd ..
```

### 5. Start the Application

Open two terminals in the project root.

**Terminal 1 — Backend**

```bash
npm run dev:backend
```

**Terminal 2 — Frontend**

```bash
npm run dev:frontend
```

Open the application at:

http://localhost:5173

The backend runs at http://localhost:5000 by default.

## Build

To build the frontend:

```bash
npm run build
```

## Project Structure

```text
groupTravelMatcher/
├── backend/          # Express APIs and database
├── frontend/         # React application
├── data/             # Traveller, group and hotel datasets
├── images/           # Hotel images
├── package.json
└── README.md
```

## Note

Hotel bookings are simulated for demonstration purposes. No real payments or reservations are made.

---

Built for **Booking Holdings Hackcellence — Group Travel Matcher**.
