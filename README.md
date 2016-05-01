# audiotour
call the number, type any number, hear it's audio or create if new


## Flow

*APP_NAME* enter your designator ID number
  user enters [KEY]
  [KEY] is new
    GOTO [NEWKEY]
  [KEY] is not new
    GOTO [OLDKEY]
      
NEWKEY
  record your communique after the beep
  *BEEP*
  *record*
  *hangup*
  
OLDKEY
  *play communique*
  *hangup*