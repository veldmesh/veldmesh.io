// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
export const CONSENT_LABEL = "I agree to receive updates from Veldmesh and understand I can unsubscribe at any time."
export const CONSENT_VERSION = "1.0"
export const MAX_SOURCE_LENGTH = 200

// Hidden anti-bot field. The form renders it hidden; humans never fill it.
export const HONEYPOT_FIELD = "company_website"

// Mission Control requires every signup to carry a `source`. When the form
// does not provide one (e.g. a direct API call), the route falls back to
// this default. Forms on known pages send their own page name instead
// ("home", "features", "docs", "waitlist").
export const DEFAULT_SOURCE = "website"
