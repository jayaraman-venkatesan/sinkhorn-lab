# Separate algorithm states from shipment presentation

Solver traces are tentative numerical states; shipment playback represents a fixed usable final plan. Keeping these separate requires additional presentation state but prevents animations from teaching that iterative reassignment means physical goods were already delivered.
