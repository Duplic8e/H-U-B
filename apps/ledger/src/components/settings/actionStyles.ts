/** The one secondary-action look on the phone Settings sheet. Every row action and
 *  full-width action (Enable reminders, Load demo data, Save client ID) shares it, so
 *  they have the same height, radius and border. min-h-[44px] is explicit because the
 *  global tap-target floor is a stylesheet rule that a unit test cannot see. Desktop
 *  keeps its own classes and never imports this. */
export const PHONE_SECONDARY_ACTION =
  'min-h-[44px] px-3 py-2 rounded-md border border-border text-[13px] text-text-secondary hover:text-accent hover:border-accent transition-colors'
