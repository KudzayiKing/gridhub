# Investment Holdings and Valuations

Holdings use the existing record collection with additive optional fields for asset class, account name, parent asset record, and notes. Quantity and unit price provide the latest manually entered market value; the valuation date remains visible. Users can update a holding through the existing edit form without changing its cost basis.

Link `Already included in asset record` when an asset record stores the full brokerage account value. Linked holdings remain in portfolio allocation and portfolio value but are excluded from total assets and asset allocation to prevent double counting.

Gain/loss uses an entered positive total cost basis only. Zero or missing basis is reported as unavailable. Investment activity records dated contributions, withdrawals, dividends, interest, and fees. Money-weighted XIRR uses those investor cash flows plus the current manually valued portfolio. Time-weighted return compounds snapshot periods only when no external flow occurred in the period; it is withheld if valuations immediately around a cash flow are missing. Reinvested distributions and fees already reflected in portfolio values are not counted again. No market data provider is configured, and no external prices are fetched.
