# ZapGoals: Decentralized Crowdfunding with Nostr Wallet Connect

## Overview


ZapGoals is a decentralized crowdfunding platform built on the Nostr protocol, with Nostr Wallet Connect (NWC) at its core for seamless, trustless payments. NWC enables users to connect their own wallets securely, authorize payments directly, and interact with the Nostr ecosystem without intermediaries. Users can create, fund, and track progress toward goals using zaps (Nostr-based payments), with real-time updates and transparent statistics. By leveraging NWC, ZapGoals ensures that all transactions are user-controlled, private, and censorship-resistant.

---

## Judging Criteria

### Impact


**Problem Solved:**  
ZapGoals addresses the challenge of transparent, decentralized crowdfunding in the Nostr ecosystem. The integration of Nostr Wallet Connect (NWC) is fundamental: it allows users to connect their own wallets, authorize zaps (payments) directly, and maintain full custody of their funds. NWC eliminates the need for custodial services or centralized payment processors, empowering communities and individuals to raise funds without intermediaries, censorship, or trust issues.

**Meaningful Outcome:**  
By making crowdfunding accessible and transparent, ZapGoals can help fund open-source projects, community initiatives, and personal causes, fostering innovation and collaboration in the Nostr space.

---

### Need

**Seriousness of the Problem:**  
Traditional crowdfunding platforms are centralized, often charge high fees, and may restrict access. In the Nostr ecosystem, there is a strong need for a trustless, censorship-resistant alternative that aligns with the values of decentralization and privacy.


**Alignment of Funding:**  
With NWC, ZapGoals ensures that all funds go directly from the funder’s wallet to the goal creator, with transparent tracking of every zap. NWC’s role guarantees that users retain control over their funds at all times, building trust and aligning incentives between funders and recipients.

---

### Proof of Work


**Builder Track Record:**  
- Modular, well-structured React codebase.
- Deep integration with Nostr relays and Nostr Wallet Connect (NWC) for real-time, decentralized, and user-controlled payments.
- Features like deduplication, live updates, and profile fetching demonstrate technical competence and attention to user experience.

---

### Feasibility


**Realistic Execution:**  
- The app is already functional: users can create/view goals, zap, and track progress, all powered by NWC for secure wallet connectivity and payment authorization.
- Clean, maintainable codebase using modern React and TypeScript.
- Real-time updates and error handling ensure a robust user experience.
- The project is executable within typical hackathon or grant timelines.

---

### Bonus


**Traction & Special Spark:**  
- Real-time zap stats and reply threads create an engaging, interactive experience.
- Deep integration with NWC positions ZapGoals at the forefront of decentralized social and financial innovation, making wallet connectivity and payments seamless and secure.
- Clean UI and seamless wallet connectivity lower the barrier for new users.

---

## Features

- **Create and View Goals:** Anyone can create a funding goal and share it with the community.
- **Zap (Fund) Goals:** Funders can zap goals directly using NWC, with instant updates and full control over their funds.
- **Transparent Progress:** Real-time tracking of total zapped, progress percentage, and balance left.
- **Replies & Community:** Users can reply to goals, fostering discussion and support.
- **Profile Integration:** Fetches and displays Nostr profile data for goal creators.

---

## How It Works

1. **Connect Wallet:** Users connect their Nostr-compatible wallet via NWC, ensuring secure, non-custodial access to their funds.
2. **Create a Goal:** Set a target amount and description.
3. **Share & Fund:** Share the goal link; anyone can zap using their wallet.
4. **Track Progress:** All zaps and replies are displayed in real time.

---

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/turizspace/zapgoals.git
   cd zapgoals
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the app:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**  
   Visit `http://localhost:5173` (or as indicated in the terminal).

---

## Tech Stack

- React + TypeScript
- Vite
- Nostr tools
- Nostr Wallet Connect (NWC) — enables secure, user-controlled wallet connections and payments

---

## Roadmap

- Mobile optimization
- Advanced goal analytics
- Social sharing features
- Multi-relay support improvements

---

## License

MIT

---

## Contact

For questions or feedback, open an issue or reach out on Nostr!
