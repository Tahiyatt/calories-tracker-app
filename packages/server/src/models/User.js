import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // select: false keeps the hash out of query results unless explicitly
    // requested, so it can't be serialised into a response by accident.
    passwordHash: { type: String, required: true, select: false },

    profile: {
      displayName: String,
      dateOfBirth: Date,
      heightCm: Number,
      // IANA zone, e.g. 'America/New_York'. Used to compute localDate on writes.
      timezone: { type: String, default: 'UTC' },
    },

    // Bumping this invalidates every outstanding refresh token: the "log out
    // everywhere" story for stateless JWTs.
    refreshTokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);
