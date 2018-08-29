using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace UXMessenger.Models
{
    public class Group
    {
        public readonly string Name = Guid.NewGuid().ToString();

        public readonly List<string> Clients = new List<string>();

        public void Add(string id)
        {
            if (!Clients.Contains(id))
                Clients.Add(id);
        }

        public void Remove(string id)
        {
            Clients.Remove(id);
        }
    }
}
