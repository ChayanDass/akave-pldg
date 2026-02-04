# Data Explorer (Go)

- **Status**: Plan Ready!  
- **Contributor**: DarkLord017 
- **Date**: February 4, 2026
- **Note:** Open for potential collaborators

**Go-based service** that connects to the blockchain RPC, filters for the storage contract’s transactions and logs, decodes them using the contract’s ABI, and writes normalized records to a database. We then expose a REST API for querying those records.

### What this service does

- Connects to an Ethereum RPC.
- Makes two kinds of calls:
    - `eth_getLogs`
    - `eth_getBlockByNumber`

### 1) Logs: `eth_getLogs`

- Add a filter.
- If the logs are from `storage.sol`, decode them.
- `eth_getLogs` has a limit on how many logs you can get in one call, so do regular polling to get all events.

### 2) Blocks: `eth_getBlockByNumber`

- Backfill blocks.
- Use retries to handle rate limits.
- Decode transactions one by one.
- If the `to` address is the contract address, decode it.

### 3) Decoding (Geth ABI)

- Use the Geth `abi` package.
- Load the contract ABI (from the compiled Go contract package or from JSON using `abi.JSON`).
- Decode:
    - Logs using `abi.Unpack`.
    - Function calls using `bind.NewBoundContract`.

### 4) Normalize into “Actions”

- Combine each decoded function call and its related events into one “action” record.
- Example fields:
    - method
    - caller
    - cid
    - size
    - bucket
    - status

### 5) Store in Postgres

- Use Postgres and define a schema.
- Tables:
    - `contracts`
    - `methods`
    - `events`
    - `actions`
    - `indexing_state` (last indexed block for resume)
- Each `action` row should include:
    - method name
    - contract address
    - caller
    - relevant parameters
    - block number
    - timestamp
    - transaction hash

### 6) REST API

- Build a REST API in Go (net/http or Gin/Gorilla) that queries the database.
- Endpoints:
    - `GET /actions?method=...&caller=...&fromBlock=...&toBlock=...`
    - `GET /actions/{id}`
    - `GET /methods`
    - `GET /contracts`
    - `GET /health-check`
- Convert query params into SQL queries on the normalized tables.

### 7) Restart mechanism

- On startup, read the latest block from Postgres.
- If it exists, resume from there instead of starting from the beginning.

### 8) Docker

- Containerize with Docker.
- Use env vars.
- Add restarting.
- Use Nginx.

### 9) Tests

- Use some transactions to test decoding.
- Test DB and HTTP APIs.
- Run the indexer for a few blocks to check it is not missing blocks (especially with `eth_getLogs`).
- Question: can we test locally, or do we need an EC2?
