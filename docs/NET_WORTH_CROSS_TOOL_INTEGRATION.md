# Net Worth Cross-Tool Integration

The dashboard currently reads only the Net Worth tool's existing records. A holding can link to a parent asset record to prevent brokerage value duplication. Other tool collections are not automatically imported or mirrored.

Do not copy a Budget account, Savings goal balance, Debt Tracker liability, or Property value into Net Worth unless the user deliberately maintains a single authoritative record and keeps duplicate records excluded. Budget income and transfers are not treated as accumulated wealth. No account linking, automatic debt synchronization, or property synchronization is currently implemented.

Net Worth charts can be pinned to the main Overview through the existing chart widget registry. These widgets read the same offline-first collections and respect the existing tool entitlement checks.
