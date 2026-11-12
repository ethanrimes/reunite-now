param emailServiceName string = 'reunite-now-email'
param communicationName string = 'reunite-now-communication'
resource email 'Microsoft.Communication/emailServices@2023-04-01' = {
 name:emailServiceName
 location:'global'
 properties:{dataLocation:'United States'}
}
resource domain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
 parent:email
 name:'AzureManagedDomain'
 location:'global'
 properties:{domainManagement:'AzureManaged',userEngagementTracking:'Disabled'}
}
resource communication 'Microsoft.Communication/communicationServices@2023-04-01' = {
 name:communicationName
 location:'global'
 properties:{dataLocation:'United States',linkedDomains:[domain.id]}
}
output senderDomain string = domain.properties.mailFromSenderDomain
output endpoint string = communication.properties.hostName
