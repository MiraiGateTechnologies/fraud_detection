#!/bin/sh
# Reviewer accounts of the review panel. Installed as /usr/local/bin/fraud-panel-users.
#
#   sudo fraud-panel-users add User1 User2     create accounts (asks for each password)
#   sudo fraud-panel-users passwd User2        set a new password
#   sudo fraud-panel-users remove User2        delete an account
#   sudo fraud-panel-users list                show accounts
exec sudo -u panel /opt/fraud-panel/venv/bin/python /opt/fraud-panel/accounts.py "$@"
