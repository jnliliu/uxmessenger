using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using UXMessenger.Models;

namespace UXMessenger.Hubs
{
    public class Messenger : Hub
    {
        private static object _clientSyncRoot = new object();
        private static object _groupSyncRoot = new object();
        private static List<string> _clients = new List<string>();
        private static List<Group> _groups = new List<Group>();

        public enum RequestConnectionResponseStatus
        {
            Disconnected = -1,
            Waiting = 0,
            Accepted = 1,
            Rejected = 2
        }

        public override async Task OnConnectedAsync()
        {
            lock (_clientSyncRoot)
            {
                _clients.Add(Context.ConnectionId);
            }

            await base.OnConnectedAsync();
            await Clients.Caller.SendAsync("connected", Context.ConnectionId);
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            lock (_clientSyncRoot)
            {
                _clients.Remove(Context.ConnectionId);
            }

            lock (_groupSyncRoot)
            {
                List<Group> toRemove = new List<Group>();
                foreach (var group in _groups.Where(g => g.Clients.Contains(Context.ConnectionId)))
                {
                    group.Remove(Context.ConnectionId);

                    if (group.Clients.Count == 0)
                        toRemove.Add(group);
                    else
                        Clients.Group(group.Name).SendAsync("userDisconnected", group.Name, Context.ConnectionId);

                    Groups.RemoveFromGroupAsync(Context.ConnectionId, group.Name);
                }

                foreach (var g in toRemove)
                    _groups.Remove(g);
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task RequestConnection(string id, string publicKey)
        {
            if (IsClientConnected(id))
            {
                await Clients.Client(id).SendAsync("requestConnection", Context.ConnectionId, publicKey);
                await Clients.Caller.SendAsync("requestConnectionResponse", null, id, RequestConnectionResponseStatus.Waiting);
            }
            else
            {
                await Clients.Caller.SendAsync("requestConnectionResponse", null, id, RequestConnectionResponseStatus.Disconnected);
            }
        }

        public async Task AcceptConnection(string id, string encryptionKey)
        {
            if (IsClientConnected(id))
            {
                var group = new Group();
                group.Add(id);
                group.Add(Context.ConnectionId);

                lock (_groupSyncRoot)
                    _groups.Add(group);

                await Groups.AddToGroupAsync(id, group.Name);
                await Groups.AddToGroupAsync(Context.ConnectionId, group.Name);

                await Clients.Client(id).SendAsync("requestConnectionResponse", group.Name, Context.ConnectionId, RequestConnectionResponseStatus.Accepted, encryptionKey);
                await Clients.Caller.SendAsync("requestConnectionResponse", group.Name, id, RequestConnectionResponseStatus.Accepted);

                //await Clients.Group(group.Name).SendAsync("message", id, "Connected!");
                //await Clients.Group(group.Name).SendAsync("message", Context.ConnectionId, "Connected!");
            }
            else
            {
                await Clients.Caller.SendAsync("userDisconnected", id);
            }
        }

        public async Task RejectConnection(string id)
        {
            await Clients.Client(id).SendAsync("requestConnectionResponse", null, Context.ConnectionId, RequestConnectionResponseStatus.Rejected);
        }

        public async Task Send(string id, string message)
        {
            await Clients.Group(id).SendAsync("message", new ChatMessage() { GroupId = id, SenderId = Context.ConnectionId, Message = message, Date = DateTime.UtcNow });
        }

        private static string GetGroupName(string id1, string id2)
        {
            return id1.CompareTo(id2) == -1 ? id1 + "-" + id2 : id2 + "-" + id1;
        }

        private static bool IsClientConnected(string id)
        {
            bool connected;

            lock (_clientSyncRoot)
            {
                connected = _clients.Contains(id);
            }

            return connected;
        }
    }
}
