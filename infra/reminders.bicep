param location string = resourceGroup().location
param appUrl string = 'https://reunite-now-9a04.azurewebsites.net'
@secure()
param cronSecret string
resource reminderSchedule 'Microsoft.Logic/workflows@2019-05-01' = {
  name: 'reunite-now-reminders'
  location: location
  properties: {
    state: 'Enabled'
    definition: {
      '$schema': 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#'
      contentVersion: '1.0.0.0'
      parameters: {
        cronSecret: { type: 'SecureString' }
      }
      triggers: {
        daily: {
          type: 'Recurrence'
          recurrence: {
            frequency: 'Day'
            interval: 1
            timeZone: 'UTC'
            schedule: { hours: [16], minutes: [0] }
          }
        }
      }
      actions: {
        check_reminders: {
          type: 'Http'
          inputs: {
            method: 'POST'
            uri: '${appUrl}/api/jobs/reminders'
            headers: { Authorization: '@concat(\'Bearer \', parameters(\'cronSecret\'))' }
            retryPolicy: { type: 'fixed', count: 2, interval: 'PT30S' }
          }
          runtimeConfiguration: { secureData: { properties: ['inputs'] } }
          runAfter: {}
        }
      }
      outputs: {}
    }
    parameters: { cronSecret: { value: cronSecret } }
  }
}
output scheduleName string = reminderSchedule.name
