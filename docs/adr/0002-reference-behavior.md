# Preserve reference behavior, add explicit assessment

Port the pinned Basic and LogDomain update/stopping behavior without silent normalization, support reduction or automatic fallback. Validate calls and add explicit result assessment outside that calculation: this exposes inconvenient failures but preserves reproducibility and makes the numerical limitations teachable.
