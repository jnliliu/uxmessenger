using Newtonsoft.Json;
using System;

namespace UXMessenger.Models
{
    public class ChatMessage
    {
        public ChatMessage()
        {
            Id = Guid.NewGuid().ToString();
        }

        [JsonProperty("id")]
        public string Id { get; set; }

        [JsonProperty("groupId")]
        public string GroupId { get; set; }

        [JsonProperty("senderId")]
        public string SenderId { get; set; }

        [JsonProperty("date")]
        public DateTime Date { get; set; }

        [JsonProperty("message")]
        public string Message { get; set; }
    }
}
