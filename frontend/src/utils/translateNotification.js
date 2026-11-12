// Translates notification titles and messages coming from the backend.
//
// Supported backend notifications:
//
// Title:
//   "New crop posted"
//   "New requirement posted"
//   "Someone is interested"
//
// Message examples:
//   "ram posted paddy near mpl."
//   "samfoods Hyderabad posted a new requirement."
//   "ram is interested in your cotton post."
//
// Usernames and locations remain unchanged.
// Crop names are translated using translateCropName().

import { translateCropName } from './i18nHelpers.js'

/* -------------------------------------------------------------------------- */
/*                                  TITLES                                    */
/* -------------------------------------------------------------------------- */

const TITLE_PATTERNS = [
  {
    regex: /^new crop posted$/i,
    key: 'notifications.templates.title.newCropPosted',
  },
  {
    regex: /^new requirement posted$/i,
    key: 'notifications.templates.title.newRequirementPosted',
  },
  {
    regex: /^someone is interested$/i,
    key: 'notifications.templates.title.someoneInterested',
  },
  {
    regex: /^listing status updated$/i,
    key: 'notifications.templates.title.statusUpdated',
  },
  {
    regex: /^crop sold out$/i,
    key: 'notifications.templates.title.cropSoldOut',
  },
]

/* -------------------------------------------------------------------------- */
/*                                 MESSAGES                                   */
/* -------------------------------------------------------------------------- */

const MESSAGE_PATTERNS = [
  {
    // ram posted paddy near mpl.
    regex: /^(.+?)\s+posted\s+(.+?)\s+near\s+(.+?)\.?$/i,

    key: 'notifications.templates.message.postedCropNear',

    buildParams: (t, [, name, crop, location]) => ({
      name,
      crop: translateCropName(t, crop),
      location,
    }),
  },

  {
    // samfoods Hyderabad posted a new requirement.
    regex: /^(.+?)\s+posted\s+a\s+new\s+requirement\.?$/i,

    key: 'notifications.templates.message.postedRequirement',

    buildParams: (t, [, name]) => ({
      name,
    }),
  },

  {
    // ram is interested in your cotton post.
    regex: /^(.+?)\s+is interested in your\s+(.+?)\s+post\.?$/i,

    key: 'notifications.templates.message.interestedInCrop',

    buildParams: (t, [, name, crop]) => ({
      name,
      crop: translateCropName(t, crop),
    }),
  },

  {
    // Your post 'Paddy' status was updated to 'archived' by administration.
    regex: /^Your post '(.+?)' status was updated to '(.+?)' by administration\.?$/i,

    key: 'notifications.templates.message.statusUpdatedAdmin',

    buildParams: (t, [, title, status]) => ({
      title,
      status: t(`listing.status.${status.toLowerCase()}`, status),
    }),
  },

  {
    // The listing for Paddy by Ramesh has been marked as sold.
    regex: /^The listing for (.+?) by (.+?) has been marked as sold\.?$/i,

    key: 'notifications.templates.message.cropSoldOut',

    buildParams: (t, [, crop, name]) => ({
      crop: translateCropName(t, crop),
      name,
    }),
  },
]

/* -------------------------------------------------------------------------- */

function translateAgainst(t, text, patterns) {
  if (!text) return text

  for (const { regex, key, buildParams } of patterns) {
    const match = text.match(regex)

    if (match) {
      return t(
        key,
        buildParams ? buildParams(t, match) : undefined
      )
    }
  }

  // Unknown notification → show original English safely
  return text
}

/* -------------------------------------------------------------------------- */

export function translateNotificationTitle(t, title) {
  return translateAgainst(t, title, TITLE_PATTERNS)
}

export function translateNotificationMessage(t, message) {
  return translateAgainst(t, message, MESSAGE_PATTERNS)
}

/* -------------------------------------------------------------------------- */

export default function translateNotification(t, notification) {
  return {
    title: translateNotificationTitle(t, notification?.title),
    message: translateNotificationMessage(t, notification?.message),
  }
}